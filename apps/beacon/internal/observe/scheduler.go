package observe

import (
	"cmp"
	"context"
	"errors"
	"log/slog"
	"slices"
	"sync"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
	"github.com/telperiontech/telperion/apps/beacon/internal/store"
)

// Scheduler polls jobs on an adaptive schedule. One goroutine (Run) owns the
// queue; at most Options.Workers polls run at once, so goroutines and
// connections do not grow with the number of packages.
type Scheduler struct {
	Store   *store.Store
	Client  *platform.Client // for the rate-limit budgets
	Build   func(catalog.Catalog) ([]Job, error)
	Publish func([]store.Change)
	OnPoll  func(layer, result string) // metrics; result ok, not_modified, error
	Log     *slog.Logger
	Opt     Options

	mu     sync.Mutex
	status map[string]JobStatus
}

// JobStatus is a job's schedule and last result, for the status page.
type JobStatus struct {
	Key       string    `json:"key"`
	Layer     string    `json:"layer"`
	Packages  []string  `json:"packages"`
	Tier      string    `json:"tier"`
	LastPoll  time.Time `json:"lastPoll,omitzero"`
	NextPoll  time.Time `json:"nextPoll"`
	LastError string    `json:"lastError,omitempty"`
	Failures  int       `json:"failures"`
}

type result struct {
	e   *entry
	obs []model.Obs
	err error
}

// loop is the state Run owns.
type loop struct {
	*Scheduler
	entries map[string]*entry
	q       queue
	rev     int64
	pending map[string]bool
	changed map[string]time.Time
}

// Run polls until ctx ends. It reloads the jobs when the catalog revision
// changes (beacon apply from another process).
func (s *Scheduler) Run(ctx context.Context) error {
	l := &loop{Scheduler: s, entries: map[string]*entry{}, changed: map[string]time.Time{}}
	if err := l.reload(ctx, true); err != nil {
		return err
	}
	results := make(chan result, s.Opt.Workers)
	reload := time.NewTicker(s.Opt.Reload)
	defer reload.Stop()
	timer := time.NewTimer(time.Hour)
	defer timer.Stop()
	busy := 0
	for {
		now := time.Now()
		for busy < s.Opt.Workers && l.q.Len() > 0 && !l.q.peek().next.After(now) {
			e := l.q.pop()
			e.running = true
			busy++
			poll := e.job.Poll // a reload may replace e.job while this runs
			go func() {
				pctx, cancel := context.WithTimeout(ctx, s.Opt.Timeout)
				defer cancel()
				obs, err := poll(pctx)
				results <- result{e: e, obs: obs, err: err}
			}()
		}
		wait := time.Hour
		if top := l.q.peek(); top != nil && busy < s.Opt.Workers {
			wait = max(time.Until(top.next), 0)
		}
		timer.Reset(wait)

		select {
		case <-ctx.Done():
			for ; busy > 0; busy-- {
				<-results
			}
			return nil
		case <-timer.C:
		case r := <-results:
			busy--
			l.handle(ctx, r)
		case <-reload.C:
			if err := l.reload(ctx, false); err != nil {
				s.Log.Error("catalog reload failed; keeping the current jobs", "err", err)
			}
		}
	}
}

// reload builds the jobs again when the catalog changed. Unchanged jobs keep
// their schedule; new or changed ones are polled soon, staggered.
func (l *loop) reload(ctx context.Context, first bool) error {
	rev, err := l.Store.CatalogRev(ctx)
	if err != nil {
		return err
	}
	if !first && rev == l.rev {
		return nil
	}
	c, err := l.Store.LoadCatalog(ctx)
	if err != nil {
		return err
	}
	jobs, err := l.Build(c)
	if err != nil {
		return err
	}
	if l.pending, err = l.Store.Pending(ctx); err != nil {
		return err
	}
	now := time.Now()
	next := map[string]*entry{}
	l.q = l.q[:0]
	for i, j := range jobs {
		e := l.entries[j.Key]
		if e == nil || e.job.Spec != j.Spec {
			e = &entry{next: now.Add(time.Duration(i) * 250 * time.Millisecond)}
		}
		e.job = j
		next[j.Key] = e
		if !e.running {
			l.q.push(e)
		}
	}
	l.entries, l.rev = next, rev
	l.Log.Info("observing", "jobs", len(jobs), "packages", len(c.Packages), "catalog_rev", rev)
	l.publishStatus()
	return nil
}

func (l *loop) handle(ctx context.Context, r result) {
	e := r.e
	e.running = false
	if l.entries[e.job.Key] != e {
		return // removed or replaced by a reload while it ran
	}
	now := time.Now()
	errMsg := ""
	switch {
	case errors.Is(r.err, platform.ErrNotModified):
		e.failures = 0
		l.count(e.job.Layer, "not_modified")
	case r.err != nil:
		e.failures++
		errMsg = r.err.Error()
		l.count(e.job.Layer, "error")
		if e.failures == 1 || e.failures%10 == 0 {
			l.Log.Warn("poll failed", "job", e.job.Key, "failures", e.failures, "err", r.err)
		}
	default:
		e.failures = 0
		l.count(e.job.Layer, "ok")
		if err := l.record(ctx, r.obs, now); err != nil {
			e.failures++
			errMsg = "store: " + err.Error()
			l.Log.Error("storing observations failed", "job", e.job.Key, "err", err)
		}
	}
	tier, d := l.Opt.tier(e, l.pending, l.changed, now)
	stretch, notBefore := l.Client.Budget(e.job.Host).Stretch(now)
	e.next = nextPoll(now, d, stretch, notBefore)
	l.q.push(e)
	l.setStatus(e, tier, now, errMsg)
}

// record stores observations and announces the changes they caused.
func (l *loop) record(ctx context.Context, obs []model.Obs, now time.Time) error {
	if len(obs) == 0 {
		return nil
	}
	changes, err := l.Store.Observe(ctx, obs)
	if err != nil || len(changes) == 0 {
		return err
	}
	for _, c := range changes {
		l.changed[c.Package] = now
	}
	if l.pending, err = l.Store.Pending(ctx); err != nil {
		return err
	}
	if l.Publish != nil {
		l.Publish(changes)
	}
	return nil
}

func (l *loop) count(layer, result string) {
	if l.OnPoll != nil {
		l.OnPoll(layer, result)
	}
}

func (l *loop) setStatus(e *entry, tier string, now time.Time, errMsg string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.status[e.job.Key] = JobStatus{
		Key: e.job.Key, Layer: e.job.Layer, Packages: e.job.Packages, Tier: tier,
		LastPoll: now, NextPoll: e.next, LastError: errMsg, Failures: e.failures,
	}
}

// publishStatus resets the status table to the current jobs.
func (l *loop) publishStatus() {
	l.mu.Lock()
	defer l.mu.Unlock()
	old := l.status
	l.status = map[string]JobStatus{}
	for k, e := range l.entries {
		st, ok := old[k]
		if !ok {
			st = JobStatus{Key: k, Layer: e.job.Layer, Packages: e.job.Packages, Tier: TierCold}
		}
		st.NextPoll = e.next
		l.status[k] = st
	}
}

// Status returns every job's status, sorted by key.
func (s *Scheduler) Status() []JobStatus {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]JobStatus, 0, len(s.status))
	for _, st := range s.status {
		out = append(out, st)
	}
	slices.SortFunc(out, func(a, b JobStatus) int { return cmp.Compare(a.Key, b.Key) })
	return out
}
