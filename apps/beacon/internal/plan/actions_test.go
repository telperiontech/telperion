package plan

import (
	"errors"
	"testing"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

func TestReleaseRunsToTheEndOfTheChain(t *testing.T) {
	h := newHarness(t)
	p, err := h.r.Preview(h.ctx, Request{Kind: model.StepRelease, Package: "lib", Bump: "minor"})
	if err != nil || len(p.Steps) != 1 {
		t.Fatalf("preview = %+v %v", p, err)
	}
	if s := p.Steps[0]; s.Version != "1.1.0" || s.From != "1.0.0" || s.Tag != "lib-v1.1.0" || s.Commit != head ||
		s.Until != model.Published || p.Major || s.Action != "tag lib-v1.1.0" {
		t.Errorf("step = %+v", s)
	}
	if _, _, err := h.r.Start(h.ctx, p.Request, Confirm{Fingerprint: "stale"}, nil); !errors.Is(err, ErrMoved) {
		t.Errorf("a stale fingerprint started: %v", err)
	}
	if major, _ := h.r.Preview(h.ctx, Request{Kind: model.StepRelease, Package: "lib", Bump: "major"}); !major.Major {
		t.Error("a major release is not marked")
	} else if _, _, err := h.r.Start(h.ctx, major.Request, Confirm{Fingerprint: major.Fingerprint}, nil); !errors.Is(err, ErrConfirm) {
		t.Errorf("a major release started without its confirmation: %v", err)
	}

	id := h.start(p.Request)
	h.pass()
	if s := h.step(id); s.State != model.StepRunning || s.Commit != head || len(h.plat.fired) != 1 {
		t.Fatalf("after firing: %+v, fired %d", s, len(h.plat.fired))
	}
	h.pass()
	if len(h.plat.fired) != 1 {
		t.Fatal("fired twice")
	}

	h.now = h.now.Add(time.Minute)
	h.observe(model.Obs{Package: "lib", Version: "1.1.0", Stage: model.Tagged, State: model.OK},
		model.Obs{Package: "lib", Version: "1.1.0", Stage: model.Built, State: model.OK})
	h.pass()
	if s := h.step(id); s.State != model.StepRunning || s.Detail != "published: missing" {
		t.Errorf("before publishing: %+v", s)
	}
	h.observe(model.Obs{Package: "lib", Version: "1.1.0", Stage: model.Published, State: model.OK})
	h.pass()
	run, _ := h.st.Run(h.ctx, id)
	if run.State != model.RunDone || run.Steps[0].State != model.StepDone {
		t.Errorf("run = %+v", run)
	}
	if ok, _, _ := h.st.Lock(h.ctx, packageLock("lib"), 99, "other"); !ok {
		t.Error("the package lock was not released")
	}
}

func TestBuildFailureFailsTheStep(t *testing.T) {
	h := newHarness(t)
	id := h.start(Request{Kind: model.StepRelease, Package: "lib", Bump: "patch"})
	h.pass()
	h.now = h.now.Add(time.Minute)
	h.observe(model.Obs{Package: "lib", Version: "1.0.1", Stage: model.Tagged, State: model.OK},
		model.Obs{Package: "lib", Version: "1.0.1", Stage: model.Built, State: model.Failed, Detail: "failure"})
	h.pass()
	if s := h.step(id); s.State != model.StepFailed || s.Detail != "built failed: failure" {
		t.Errorf("step = %+v", s)
	}
}

func TestPackageLockBlocksASecondRun(t *testing.T) {
	h := newHarness(t)
	first := h.start(Request{Kind: model.StepRelease, Package: "lib", Bump: "patch"})
	second := h.start(Request{Kind: model.StepRelease, Package: "lib", Version: "2.0.0"})
	h.pass()
	if s := h.step(second); s.State != model.StepBlocked {
		t.Errorf("second = %+v", s)
	}
	if err := h.r.cancel(h.ctx, first); err != nil {
		t.Fatal(err)
	}
	h.pass()
	if s := h.step(second); s.State != model.StepRunning {
		t.Errorf("second after the first was cancelled = %+v", s)
	}
}

func TestRestartWhileFiringDoesNotFireTwice(t *testing.T) {
	h := newHarness(t)
	c := testCatalog()
	c.Packages[0].Release = &catalog.Release{GitHubDispatch: &catalog.GitHubDispatch{Workflow: "release.yml"}}
	if err := h.st.SaveCatalog(h.ctx, c); err != nil {
		t.Fatal(err)
	}
	id := h.start(Request{Kind: model.StepRelease, Package: "lib", Bump: "patch"})
	s := h.step(id)
	s.State, s.Fired = model.StepTriggering, h.now // stored intent, no answer
	if err := h.st.SaveStep(h.ctx, id, s); err != nil {
		t.Fatal(err)
	}
	h.pass()
	if s := h.step(id); s.State != model.StepRunning || len(h.plat.fired) != 0 {
		t.Errorf("step = %+v, fired %d", s, len(h.plat.fired))
	}
}

func TestTagTimeout(t *testing.T) {
	h := newHarness(t)
	id := h.start(Request{Kind: model.StepRelease, Package: "lib", Bump: "patch"})
	h.pass()
	h.now = h.now.Add(TagTimeout + time.Minute)
	h.pass()
	if s := h.step(id); s.State != model.StepFailed {
		t.Errorf("step = %+v", s)
	}
}

func TestDeploy(t *testing.T) {
	h := newHarness(t)
	h.observe(model.Obs{Package: "svc", Version: "1.0.0", Stage: model.Deployed, Target: "main", State: model.OK, Exclusive: true})
	if p, _ := h.r.Preview(h.ctx, Request{Kind: model.StepDeploy, Package: "svc", Target: "nowhere", Version: "1.1.0"}); len(p.Errors) == 0 {
		t.Error("a deploy to an unknown target has no error")
	}
	id := h.start(Request{Kind: model.StepDeploy, Package: "svc", Target: "main", Version: "1.1.0"})
	h.plat.status = model.Pending
	h.pass()
	if s := h.step(id); s.State != model.StepRunning || s.DeployID != "dep-1" || s.From != "1.0.0" || len(h.plat.deployed) != 1 {
		t.Fatalf("step = %+v", s)
	}
	h.now = h.now.Add(time.Minute)
	h.observe(model.Obs{Package: "svc", Version: "1.1.0", Stage: model.Deployed, Target: "main", State: model.OK, Exclusive: true})
	h.pass()
	if s := h.step(id); s.State != model.StepDone {
		t.Errorf("step = %+v", s)
	}
}

func TestDeployFailure(t *testing.T) {
	h := newHarness(t)
	id := h.start(Request{Kind: model.StepDeploy, Package: "svc", Target: "main", Version: "1.1.0"})
	h.plat.status = model.Failed
	h.pass()
	if s := h.step(id); s.State != model.StepFailed || s.Detail != "deployment failed" {
		t.Errorf("step = %+v", s)
	}
}
