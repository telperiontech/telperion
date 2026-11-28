package plan

import (
	"strings"
	"testing"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

// wave releases lib, sets app's range to it, then releases app.
func wave(via model.Via) *model.Plan {
	return &model.Plan{Steps: []model.PlanStep{
		{Key: "app", Type: model.StepRelease, Package: "app", Bump: "patch", Needs: []string{"app-deps"}},
		{Key: "app-deps", Type: model.StepUpdateDeps, Package: "app", Deps: []string{"lib"}, Via: via, Needs: []string{"lib"}},
		{Key: "lib", Type: model.StepRelease, Package: "lib", Bump: "minor"},
	}}
}

func TestPlanPreviewOrdersAndShowsEveryChange(t *testing.T) {
	h := newHarness(t)
	p, err := h.r.Preview(h.ctx, Request{Plan: wave(model.ViaCommit)})
	if err != nil || len(p.Errors) > 0 {
		t.Fatalf("preview = %+v %v", p, err)
	}
	var keys []string
	for _, s := range p.Steps {
		keys = append(keys, s.Key)
	}
	if strings.Join(keys, ",") != "lib,app-deps,app" {
		t.Errorf("order = %v", keys)
	}
	deps := p.Steps[1]
	if deps.State != model.StepWaiting || len(deps.Deps) != 1 || deps.Deps[0].From != "^1.0.0" || deps.Deps[0].To != "^1.1.0" ||
		deps.File != "libs/app/package.json" || !strings.Contains(deps.Action, "@acme/lib ^1.0.0 → ^1.1.0") {
		t.Errorf("update-deps = %+v", deps)
	}
	if app := p.Steps[2]; app.Version != "2.0.1" || app.Commit != "" || !strings.HasPrefix(p.Title, "plan of 3 steps") {
		t.Errorf("app = %+v, title %q", app, p.Title)
	}

	bad := wave(model.ViaCommit)
	bad.Steps[1].Needs = nil // the range would name a version that does not exist yet
	bad.Steps = append(bad.Steps, model.PlanStep{Key: "x", Type: model.StepRelease, Package: "svc", Bump: "patch", Needs: []string{"y"}},
		model.PlanStep{Key: "y", Type: model.StepDeploy, Package: "svc", Target: "main", Version: "1.0.0", Needs: []string{"x"}})
	p, _ = h.r.Preview(h.ctx, Request{Plan: bad})
	joined := strings.Join(p.Errors, "\n")
	for _, want := range []string{"app-deps: uses the version of lib that step lib releases", "cycle", "x: svc has no release trigger"} {
		if !strings.Contains(joined, want) {
			t.Errorf("errors lack %q:\n%s", want, joined)
		}
	}
}

func TestPlanRunsInOrderAndCommitsBeforeTheRelease(t *testing.T) {
	h := newHarness(t)
	id := h.start(Request{Plan: wave(model.ViaCommit)})
	h.pass()
	if lib, deps := h.stepOf(id, "lib"), h.stepOf(id, "app-deps"); lib.State != model.StepRunning || deps.State != model.StepWaiting {
		t.Fatalf("lib %+v, deps %+v", lib, deps)
	}
	h.now = h.now.Add(time.Minute)
	h.chain("lib", "1.1.0")
	h.pass()
	if deps := h.stepOf(id, "app-deps"); deps.State != model.StepDone || deps.Commit != "commit1" {
		t.Fatalf("deps = %+v", deps)
	}
	if got := h.plat.files["libs/app/package.json"]; got != `{"peerDependencies": {"@acme/lib": "^1.1.0"}}` {
		t.Errorf("manifest = %s", got)
	}
	app := h.stepOf(id, "app")
	if app.State != model.StepRunning || len(h.plat.fired) != 2 || h.plat.fired[1].Commit != "commit1" {
		t.Fatalf("app = %+v, fired %+v", app, h.plat.fired)
	}
	h.now = h.now.Add(time.Minute)
	h.chain("app", "2.0.1")
	h.pass()
	if run := h.run(id); run.State != model.RunDone || run.Plan == nil || len(run.Plan.Steps) != 3 {
		t.Errorf("run = %+v", run)
	}
}

func TestSameRepoReleasesAreBatched(t *testing.T) {
	h := newHarness(t)
	id := h.start(Request{Plan: &model.Plan{Steps: []model.PlanStep{
		{Key: "lib", Type: model.StepRelease, Package: "lib", Bump: "patch"},
		{Key: "app", Type: model.StepRelease, Package: "app", Bump: "patch"},
	}}})
	h.pass()
	if len(h.plat.fired) != 2 || h.plat.fired[0].Commit != head || h.plat.fired[1].Commit != head {
		t.Fatalf("fired = %+v", h.plat.fired)
	}
	if lib, app := h.stepOf(id, "lib"), h.stepOf(id, "app"); lib.Commit != head || app.Commit != head {
		t.Errorf("commits = %s, %s", lib.Commit, app.Commit)
	}
	if entries, _ := h.st.ListAudit(h.ctx, 0, 10); !strings.Contains(entries[0].Detail, "lib-v1.0.1, app-v2.0.1 at aaaaaaa on main") {
		t.Errorf("audit = %+v", entries[0])
	}
}

func TestFailFastCancelsWhatHasNotStarted(t *testing.T) {
	for _, failFast := range []bool{false, true} {
		h := newHarness(t)
		blocker := h.start(Request{Kind: model.StepRelease, Package: "app", Bump: "patch"})
		h.pass()
		id := h.start(Request{Plan: &model.Plan{FailFast: failFast, Steps: []model.PlanStep{
			{Key: "lib", Type: model.StepRelease, Package: "lib", Bump: "patch"},
			{Key: "app", Type: model.StepRelease, Package: "app", Version: "3.0.0"},
		}}})
		h.pass()
		if s := h.stepOf(id, "app"); s.State != model.StepBlocked {
			t.Fatalf("app = %+v", s)
		}
		h.now = h.now.Add(time.Minute)
		h.observe(model.Obs{Package: "lib", Version: "1.0.1", Stage: model.Tagged, State: model.OK},
			model.Obs{Package: "lib", Version: "1.0.1", Stage: model.Built, State: model.Failed, Detail: "failure"})
		h.pass()
		app := h.stepOf(id, "app")
		switch {
		case failFast && (app.State != model.StepCancelled || h.run(id).State != model.RunFailed):
			t.Errorf("fail-fast: app = %+v, run %s", app, h.run(id).State)
		case !failFast && app.State != model.StepBlocked:
			t.Errorf("without fail-fast the independent step stopped: %+v", app)
		}
		_ = blocker
	}
}

func TestResumeRetriesWithTheSameVersion(t *testing.T) {
	h := newHarness(t)
	id := h.start(Request{Kind: model.StepRelease, Package: "lib", Bump: "patch"})
	h.pass()
	h.now = h.now.Add(time.Minute)
	h.observe(model.Obs{Package: "lib", Version: "1.0.1", Stage: model.Tagged, State: model.OK},
		model.Obs{Package: "lib", Version: "1.0.1", Stage: model.Built, State: model.Failed, Detail: "failure"})
	h.pass()
	if run := h.run(id); run.State != model.RunFailed {
		t.Fatalf("run = %+v", run)
	}
	if err := h.r.resume(h.ctx, id); err != nil {
		t.Fatal(err)
	}
	if err := h.r.resume(h.ctx, id); err == nil {
		t.Error("a running run was resumed")
	}
	h.plat.refs.Tags = append(h.plat.refs.Tags, adapter.Tag{Name: "lib-v1.0.1", Commit: head})
	h.now = h.now.Add(time.Minute)
	h.pass()
	s := h.step(id)
	if s.State != model.StepRunning || !s.Adopted || s.Version != "1.0.1" || s.Attempt != 1 ||
		len(h.plat.fired) != 1 || len(h.plat.reruns) != 1 {
		t.Fatalf("resumed = %+v, fired %d, reruns %v", s, len(h.plat.fired), h.plat.reruns)
	}
	h.now = h.now.Add(time.Minute)
	h.chain("lib", "1.0.1")
	h.pass()
	if run := h.run(id); run.State != model.RunDone {
		t.Errorf("run = %+v", run)
	}
}

func TestUpdateDepsByPullRequestPauses(t *testing.T) {
	h := newHarness(t)
	h.chain("lib", "1.0.0")
	h.chain("lib", "1.2.0")
	id := h.start(Request{Plan: &model.Plan{Steps: []model.PlanStep{
		{Key: "deps", Type: model.StepUpdateDeps, Package: "app", Deps: []string{"lib"}, Via: model.ViaPR},
	}}})
	h.plat.prState = adapter.PROpen
	h.pass()
	s := h.step(id)
	if s.State != model.StepPaused || s.PR != 1 || len(h.plat.prs) != 1 || !strings.Contains(string(h.plat.prs[0].Content), "^1.2.0") {
		t.Fatalf("step = %+v, prs %+v", s, h.plat.prs)
	}
	h.now = h.now.Add(StallTimeout + time.Hour) // a pull request may wait for days
	h.pass()
	if s := h.step(id); s.State != model.StepPaused {
		t.Fatalf("after a long wait: %+v", s)
	}
	h.plat.prState = adapter.PRMerged
	h.now = h.now.Add(time.Minute)
	h.pass()
	if s := h.step(id); s.State != model.StepDone || s.Commit != "merged" || h.plat.commits != 0 {
		t.Errorf("step = %+v", s)
	}
}

func TestRecipeFromTheCatalog(t *testing.T) {
	h := newHarness(t)
	c := testCatalog()
	c.Recipes = []model.Plan{{Name: "wave", Managed: true, Steps: wave(model.ViaCommit).Steps}}
	if err := h.st.SaveCatalog(h.ctx, c); err != nil {
		t.Fatal(err)
	}
	p, err := h.r.Preview(h.ctx, Request{Recipe: "wave"})
	if err != nil || len(p.Errors) > 0 || p.Title != "wave" || p.Recipe != "wave" || len(p.Steps) != 3 {
		t.Fatalf("preview = %+v %v", p, err)
	}
	if p, _ := h.r.Preview(h.ctx, Request{Recipe: "nope"}); len(p.Errors) != 1 {
		t.Errorf("an unknown recipe: %+v", p.Errors)
	}
}
