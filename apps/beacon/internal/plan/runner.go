package plan

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/observe"
	"github.com/telperiontech/telperion/apps/beacon/internal/store"
	"github.com/telperiontech/telperion/libs/go-kit/audit"
)

// Runner advances active plan runs. One goroutine (Run) owns every step
// change; it works when a run starts, when observations change, and every
// Interval while runs are active. With no active run it only waits.
type Runner struct {
	Env
	Interval    time.Duration // between passes while runs are active; default 5 s
	StatusEvery time.Duration // between deploy status requests per step; default 15 s

	once       sync.Once
	kicks      chan struct{}
	cancels    chan cancelReq
	lastStatus map[string]time.Time // owned by Run
}

type cancelReq struct {
	ctx  context.Context
	run  int64
	done chan error
}

func (r *Runner) init() {
	r.once.Do(func() {
		r.kicks = make(chan struct{}, 1)
		r.cancels = make(chan cancelReq)
		r.lastStatus = map[string]time.Time{}
		if r.Interval == 0 {
			r.Interval = 5 * time.Second
		}
		if r.StatusEvery == 0 {
			r.StatusEvery = 15 * time.Second
		}
	})
}

// Kick asks for a pass soon (a run was started).
func (r *Runner) Kick() {
	r.init()
	select {
	case r.kicks <- struct{}{}:
	default:
	}
}

// Cancel stops a run: steps that have not fired are cancelled, and running
// ones are no longer watched (a CI run or deploy they started goes on).
func (r *Runner) Cancel(ctx context.Context, run int64) error {
	r.init()
	req := cancelReq{ctx: ctx, run: run, done: make(chan error, 1)}
	select {
	case r.cancels <- req:
	case <-ctx.Done():
		return ctx.Err()
	}
	return <-req.done
}

// Run works until ctx ends. notices are the broker's (observations changed).
func (r *Runner) Run(ctx context.Context, notices <-chan observe.Notice) error {
	r.init()
	ctx = audit.WithActor(ctx, audit.Actor{Source: "plan", Who: "beacon"})
	timer := time.NewTimer(0)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-timer.C:
		case <-r.kicks:
		case <-notices:
		case req := <-r.cancels:
			req.done <- r.cancel(req.ctx, req.run)
		}
		active, err := r.pass(ctx)
		if err != nil {
			r.Log.Error("plan pass failed", "err", err)
		}
		wait := time.Hour
		if active > 0 || err != nil {
			wait = r.Interval
		}
		if !timer.Stop() {
			select {
			case <-timer.C:
			default:
			}
		}
		timer.Reset(wait)
	}
}

// world is what one pass reads once.
type world struct {
	cat    catalog.Catalog
	plat   Platform
	states map[string]*store.PackageState
	runs   []model.Run
	now    time.Time
}

// pass advances every active run once and returns how many are active.
func (r *Runner) pass(ctx context.Context) (int, error) {
	runs, err := r.Store.ActiveRuns(ctx)
	if err != nil || len(runs) == 0 {
		return 0, err
	}
	if err := r.Store.ReleaseStaleLocks(ctx); err != nil {
		return len(runs), err
	}
	w := &world{runs: runs, now: r.now()}
	if w.cat, err = r.Store.LoadCatalog(ctx); err != nil {
		return len(runs), err
	}
	if w.plat, err = r.Platform(w.cat); err != nil {
		return len(runs), err
	}
	if w.states, err = r.Store.States(ctx, ""); err != nil {
		return len(runs), err
	}
	active := 0
	for i := range w.runs {
		run := &w.runs[i]
		changed, err := r.advanceRun(ctx, w, run)
		if err != nil {
			return len(runs), fmt.Errorf("run %d: %w", run.ID, err)
		}
		finished, err := r.finishRun(ctx, run)
		if err != nil {
			return len(runs), err
		}
		if !finished {
			active++
		}
		if changed || finished {
			r.publish(observe.Notice{Packages: runPackages(run), Runs: []int64{run.ID}})
		}
	}
	return active, nil
}

// advanceRun moves each step as far as it goes in this pass.
func (r *Runner) advanceRun(ctx context.Context, w *world, run *model.Run) (bool, error) {
	changed := false
	for j := range run.Steps {
		st := &run.Steps[j]
		for range 4 { // ready → triggering → running → done can happen in one pass
			before := *st
			if err := r.advance(ctx, w, run, st); err != nil {
				return changed, err
			}
			if same(before, *st) {
				break
			}
			changed = true
			if err := r.Store.SaveStep(ctx, run.ID, *st); err != nil {
				return changed, err
			}
			if st.State.Terminal() {
				if err := r.finishStep(ctx, run, st); err != nil {
					return changed, err
				}
				break
			}
		}
	}
	return changed, nil
}

// finishStep releases the step's locks and audits its outcome.
func (r *Runner) finishStep(ctx context.Context, run *model.Run, st *model.Step) error {
	if err := r.Store.ReleaseLocks(ctx, run.ID, st.Key); err != nil {
		return err
	}
	delete(r.lastStatus, statusKey(run.ID, st.Key))
	return r.Store.Audit(ctx, "plan.step."+string(st.State), fmt.Sprintf("run %d", run.ID), st.Key+": "+st.Detail)
}

// finishRun ends a run whose steps are all finished: done when every step
// is, cancelled when one was cancelled and none failed, failed otherwise.
func (r *Runner) finishRun(ctx context.Context, run *model.Run) (bool, error) {
	state := model.RunDone
	for _, s := range run.Steps {
		switch {
		case !s.State.Terminal():
			return false, nil
		case s.State == model.StepFailed || s.State == model.StepSkipped:
			state = model.RunFailed
		case s.State == model.StepCancelled && state == model.RunDone:
			state = model.RunCancelled
		}
	}
	if err := r.Store.FinishRun(ctx, run.ID, state); err != nil {
		return false, err
	}
	run.State = state
	return true, r.Store.Audit(ctx, "plan.finish", fmt.Sprintf("run %d", run.ID), run.Title+": "+string(state))
}

func (r *Runner) cancel(ctx context.Context, id int64) error {
	run, err := r.Store.Run(ctx, id)
	if err != nil {
		return err
	}
	if run.State != model.RunRunning {
		return fmt.Errorf("run %d has finished (%s)", id, run.State)
	}
	now := r.now()
	for i := range run.Steps {
		st := &run.Steps[i]
		if st.State.Terminal() {
			continue
		}
		if st.State == model.StepRunning {
			st.Detail = "cancelled; what it started goes on, unwatched"
		} else {
			st.Detail = "cancelled before it fired"
		}
		st.State, st.Finished = model.StepCancelled, now
		if err := r.Store.SaveStep(ctx, id, *st); err != nil {
			return err
		}
		if err := r.Store.ReleaseLocks(ctx, id, st.Key); err != nil {
			return err
		}
	}
	if err := r.Store.FinishRun(ctx, id, model.RunCancelled); err != nil {
		return err
	}
	r.publish(observe.Notice{Packages: runPackages(&run), Runs: []int64{id}})
	return r.Store.Audit(ctx, "plan.cancel", fmt.Sprintf("run %d", id), run.Title)
}

func runPackages(run *model.Run) []string {
	names := make([]string, 0, len(run.Steps))
	for _, s := range run.Steps {
		names = append(names, s.Package)
	}
	return observe.PackagesNotice(names).Packages
}

func statusKey(run int64, step string) string { return fmt.Sprint(run, "/", step) }

func same(a, b model.Step) bool {
	return a.State == b.State && a.Detail == b.Detail && a.URL == b.URL && a.Commit == b.Commit &&
		a.DeployID == b.DeployID && a.Adopted == b.Adopted && a.Fired.Equal(b.Fired) &&
		a.Progress.Equal(b.Progress) && a.Finished.Equal(b.Finished)
}
