package observe

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync/atomic"
	"testing"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
	"github.com/telperiontech/telperion/apps/beacon/internal/store"
)

func TestTiers(t *testing.T) {
	o := DefaultOptions()
	now := time.Now()
	e := &entry{job: Job{Packages: []string{"a"}}}
	if tier, d := o.tier(e, nil, nil, now); tier != TierCold || d != o.Cold {
		t.Errorf("idle = %s %v", tier, d)
	}
	if tier, _ := o.tier(e, nil, map[string]time.Time{"a": now.Add(-time.Minute)}, now); tier != TierWarm {
		t.Errorf("recent change = %s", tier)
	}
	if tier, d := o.tier(e, map[string]bool{"a": true}, nil, now); tier != TierHot || d != o.Hot {
		t.Errorf("pending = %s %v", tier, d)
	}
	e.failures = 3
	if tier, d := o.tier(e, map[string]bool{"a": true}, nil, now); tier != TierBackoff || d != 4*o.Hot {
		t.Errorf("third failure = %s %v", tier, d)
	}
	e.failures = 40
	if _, d := o.tier(e, nil, nil, now); d != o.Cold {
		t.Errorf("backoff is not capped at cold: %v", d)
	}
}

func TestTagObservations(t *testing.T) {
	a, _ := catalog.NewTagMatcher(catalog.DefaultTag, "a")
	ab, _ := catalog.NewTagMatcher(catalog.DefaultTag, "a-b")
	obs := TagObservations([]adapter.Tag{{Name: "a-v1.0.0"}, {Name: "a-b-v2.0.0"}, {Name: "other"}},
		[]string{"a", "a-b"}, []catalog.TagMatcher{a, ab})
	if len(obs) != 2 || obs[0].Package != "a" || obs[1].Package != "a-b" || obs[1].Version != "2.0.0" {
		t.Errorf("obs = %+v", obs)
	}
}

// TestRunPollsStoresAndPublishes runs the loop with fake jobs.
func TestRunPollsStoresAndPublishes(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	st, err := store.Open(ctx, ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()

	var polls atomic.Int32
	published := make(chan []store.Change, 4)
	s := &Scheduler{
		Store: st, Client: platform.New("t", time.Second), Log: slog.New(slog.NewTextHandler(io.Discard, nil)),
		Opt:     Options{Hot: time.Hour, Warm: time.Hour, Cold: time.Hour, WarmFor: time.Hour, Workers: 2, Reload: time.Hour, Timeout: time.Second},
		Publish: func(cs []store.Change) { published <- cs },
		Build: func(catalog.Catalog) ([]Job, error) {
			return []Job{
				{Key: "ok", Packages: []string{"p"}, Poll: func(context.Context) ([]model.Obs, error) {
					polls.Add(1)
					return []model.Obs{{Package: "p", Version: "1.0.0", Stage: model.Tagged, State: model.OK}}, nil
				}},
				{Key: "broken", Packages: []string{"q"}, Poll: func(context.Context) ([]model.Obs, error) {
					return nil, errors.New("down")
				}},
			}, nil
		},
	}
	done := make(chan error)
	go func() { done <- s.Run(ctx) }()

	select {
	case cs := <-published:
		if len(cs) != 1 || cs[0].Package != "p" || cs[0].To != model.OK {
			t.Errorf("published %+v", cs)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("nothing was published")
	}
	deadline := time.Now().Add(5 * time.Second)
	for {
		st := s.Status()
		if len(st) == 2 && st[0].Key == "broken" && st[0].Failures == 1 && st[0].Tier == TierBackoff {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("status = %+v", st)
		}
		time.Sleep(10 * time.Millisecond)
	}
	cancel()
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	if polls.Load() != 1 {
		t.Errorf("polled %d times within an hour-long interval", polls.Load())
	}
}
