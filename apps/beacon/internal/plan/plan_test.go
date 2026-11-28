package plan

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/store"
	"github.com/telperiontech/telperion/libs/go-kit/audit"
)

const head = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

// fakePlatform records writes and answers reads from its fields.
type fakePlatform struct {
	refs     adapter.Refs
	fired    []adapter.ReleaseRequest
	deployed []string
	status   model.State
}

func (f *fakePlatform) Refs(context.Context, catalog.Repo) (adapter.Refs, error) { return f.refs, nil }

func (f *fakePlatform) Trigger(p catalog.Package) (adapter.Trigger, bool) {
	return fakeTrigger{f}, p.Release != nil
}

func (f *fakePlatform) Rerunner(catalog.Package) (adapter.Rerunner, bool) { return nil, false }

func (f *fakePlatform) Deployer(p catalog.Package, target string) (adapter.Deployer, catalog.Deploy, bool) {
	d, ok := p.DeployTo(target)
	return fakeDeployer{f}, d, ok && d.Coolify != nil
}

type fakeTrigger struct{ f *fakePlatform }

func (fakeTrigger) Describe(req adapter.ReleaseRequest) string { return "tag " + req.Tag }
func (t fakeTrigger) Fire(_ context.Context, req adapter.ReleaseRequest) (adapter.Fired, error) {
	t.f.fired = append(t.f.fired, req)
	return adapter.Fired{Detail: "fired"}, nil
}

type fakeDeployer struct{ f *fakePlatform }

func (d fakeDeployer) Deploy(_ context.Context, _ string, _ catalog.Deploy, v string) (adapter.DeployRef, error) {
	d.f.deployed = append(d.f.deployed, v)
	return adapter.DeployRef{ID: "dep-1"}, nil
}
func (d fakeDeployer) DeployStatus(context.Context, catalog.Deploy, adapter.DeployRef) (model.State, string, error) {
	return d.f.status, string(d.f.status), nil
}

func testCatalog() catalog.Catalog {
	repo := catalog.Repo{GitHub: "acme/libs", URL: "https://github.example.com/acme/libs.git"}
	return catalog.Catalog{
		Targets:  []catalog.Target{{Name: "main", Limit: 1, Coolify: &catalog.Coolify{URL: "https://coolify.example.com"}}},
		Projects: []catalog.Project{{Name: "acme", Repo: repo}},
		Packages: []catalog.Package{
			{
				Name: "lib", Project: "acme", Repo: repo, Tag: catalog.DefaultTag,
				Release:  &catalog.Release{GitHubRelease: &catalog.GitHubRelease{Notes: catalog.NotesGenerate}},
				CI:       &catalog.CI{GitHubActions: &catalog.GitHubActions{Workflow: "lib.publish.yml"}},
				Artifact: &catalog.Artifact{NPM: &catalog.NPM{Name: "@acme/lib", Registry: "https://registry.example.com"}},
			},
			{
				Name: "svc", Project: "acme", Repo: repo, Tag: catalog.DefaultTag,
				Deploy: []catalog.Deploy{{Target: "main", Coolify: &catalog.CoolifyApp{App: "app-1"}}},
			},
		},
	}
}

type harness struct {
	t    *testing.T
	ctx  context.Context
	st   *store.Store
	plat *fakePlatform
	r    *Runner
	now  time.Time
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	ctx := audit.WithActor(context.Background(), audit.Actor{Source: "ui", Who: "tester"})
	st, err := store.Open(ctx, ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	if err := st.SaveCatalog(ctx, testCatalog()); err != nil {
		t.Fatal(err)
	}
	h := &harness{t: t, ctx: ctx, st: st, now: time.Unix(1_800_000_000, 0),
		plat: &fakePlatform{refs: adapter.Refs{
			Tags: []adapter.Tag{{Name: "lib-v1.0.0", Commit: "b"}}, Heads: map[string]string{"main": head}, Default: "main",
		}}}
	st.SetClock(func() time.Time { return h.now })
	h.r = &Runner{Env: Env{
		Store: st, Log: slog.New(slog.NewTextHandler(io.Discard, nil)), Now: func() time.Time { return h.now },
		Platform: func(catalog.Catalog) (Platform, error) { return h.plat, nil },
	}}
	h.r.init()
	return h
}

func (h *harness) start(req Request) int64 {
	h.t.Helper()
	p, err := h.r.Preview(h.ctx, req)
	if err != nil || len(p.Errors) > 0 {
		h.t.Fatalf("preview = %+v %v", p, err)
	}
	id, _, err := h.r.Start(h.ctx, req, Confirm{Fingerprint: p.Fingerprint, Major: p.Major}, nil)
	if err != nil {
		h.t.Fatal(err)
	}
	return id
}

func (h *harness) pass() {
	h.t.Helper()
	if _, err := h.r.pass(h.ctx); err != nil {
		h.t.Fatal(err)
	}
}

func (h *harness) step(id int64) model.Step {
	h.t.Helper()
	run, err := h.st.Run(h.ctx, id)
	if err != nil {
		h.t.Fatal(err)
	}
	return run.Steps[0]
}

func (h *harness) observe(obs ...model.Obs) {
	h.t.Helper()
	if _, err := h.st.Observe(h.ctx, obs); err != nil {
		h.t.Fatal(err)
	}
}

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
