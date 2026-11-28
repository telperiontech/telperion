package plan

import (
	"context"
	"fmt"
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
	reruns   []string
	status   model.State
	files    map[string]string // path → content on main
	commits  int
	prs      []adapter.FileChange
	prState  adapter.PRState
}

func (f *fakePlatform) Refs(context.Context, catalog.Repo) (adapter.Refs, error) { return f.refs, nil }

func (f *fakePlatform) Trigger(p catalog.Package) (adapter.Trigger, bool) {
	return fakeTrigger{f}, p.Release != nil
}

func (f *fakePlatform) Rerunner(p catalog.Package) (adapter.Rerunner, bool) {
	return fakeRerunner{f}, p.CI != nil
}

func (f *fakePlatform) Deployer(p catalog.Package, target string) (adapter.Deployer, catalog.Deploy, bool) {
	d, ok := p.DeployTo(target)
	return fakeDeployer{f}, d, ok && d.Coolify != nil
}

func (f *fakePlatform) Committer(p catalog.Package) (adapter.Committer, bool) {
	return fakeCommitter{f}, p.Repo.GitHub != ""
}

type fakeTrigger struct{ f *fakePlatform }

func (fakeTrigger) Describe(req adapter.ReleaseRequest) string { return "tag " + req.Tag }
func (t fakeTrigger) Fire(_ context.Context, req adapter.ReleaseRequest) (adapter.Fired, error) {
	t.f.fired = append(t.f.fired, req)
	return adapter.Fired{Detail: "fired"}, nil
}

type fakeRerunner struct{ f *fakePlatform }

func (r fakeRerunner) Rerun(_ context.Context, _ catalog.Package, tag string) (adapter.Fired, error) {
	r.f.reruns = append(r.f.reruns, tag)
	return adapter.Fired{Detail: "re-ran"}, nil
}

type fakeDeployer struct{ f *fakePlatform }

func (d fakeDeployer) Deploy(_ context.Context, _ string, _ catalog.Deploy, v string) (adapter.DeployRef, error) {
	d.f.deployed = append(d.f.deployed, v)
	return adapter.DeployRef{ID: "dep-1"}, nil
}
func (d fakeDeployer) DeployStatus(context.Context, catalog.Deploy, adapter.DeployRef) (model.State, string, error) {
	return d.f.status, string(d.f.status), nil
}

// fakeCommitter keeps files on main; a commit moves the head of main.
type fakeCommitter struct{ f *fakePlatform }

func (c fakeCommitter) ReadFile(_ context.Context, _ catalog.Repo, _, path string) (adapter.File, error) {
	content, ok := c.f.files[path]
	if !ok {
		return adapter.File{}, fmt.Errorf("%s: not found", path)
	}
	return adapter.File{Path: path, Content: []byte(content), SHA: "blob"}, nil
}

func (c fakeCommitter) Commit(_ context.Context, ch adapter.FileChange, _ string) (string, string, error) {
	c.f.commits++
	c.f.files[ch.Path] = string(ch.Content)
	commit := fmt.Sprintf("commit%d", c.f.commits)
	c.f.refs.Heads["main"] = commit
	return commit, "https://github.example.com/c/" + commit, nil
}

func (c fakeCommitter) OpenPR(_ context.Context, ch adapter.FileChange, head, _, _ string) (adapter.PullRequest, error) {
	c.f.prs = append(c.f.prs, ch)
	return adapter.PullRequest{Number: len(c.f.prs), URL: "https://github.example.com/pr/" + head, State: adapter.PROpen}, nil
}

func (c fakeCommitter) PullRequest(_ context.Context, _ catalog.Repo, n int) (adapter.PullRequest, error) {
	return adapter.PullRequest{Number: n, State: c.f.prState, Merge: "merged"}, nil
}

func testCatalog() catalog.Catalog {
	repo := catalog.Repo{GitHub: "acme/libs", URL: "https://github.example.com/acme/libs.git"}
	release := &catalog.Release{GitHubRelease: &catalog.GitHubRelease{Notes: catalog.NotesGenerate}}
	npmPkg := func(name string) catalog.Package {
		return catalog.Package{
			Name: name, Project: "acme", Repo: repo, Tag: catalog.DefaultTag, Path: "libs/" + name, Release: release,
			CI:       &catalog.CI{GitHubActions: &catalog.GitHubActions{Workflow: name + ".publish.yml"}},
			Artifact: &catalog.Artifact{NPM: &catalog.NPM{Name: "@acme/" + name, Registry: "https://registry.example.com"}},
		}
	}
	return catalog.Catalog{
		Targets:  []catalog.Target{{Name: "main", Limit: 1, Coolify: &catalog.Coolify{URL: "https://coolify.example.com"}}},
		Projects: []catalog.Project{{Name: "acme", Repo: repo}},
		Packages: []catalog.Package{
			npmPkg("lib"),
			{
				Name: "svc", Project: "acme", Repo: repo, Tag: catalog.DefaultTag,
				Deploy: []catalog.Deploy{{Target: "main", Coolify: &catalog.CoolifyApp{App: "app-1"}}},
			},
			npmPkg("app"),
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
		plat: &fakePlatform{
			refs: adapter.Refs{
				Tags:  []adapter.Tag{{Name: "lib-v1.0.0", Commit: "b"}, {Name: "app-v2.0.0", Commit: "b"}},
				Heads: map[string]string{"main": head}, Default: "main",
			},
			files: map[string]string{"libs/app/package.json": `{"peerDependencies": {"@acme/lib": "^1.0.0"}}`},
		}}
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

func (h *harness) run(id int64) model.Run {
	h.t.Helper()
	run, err := h.st.Run(h.ctx, id)
	if err != nil {
		h.t.Fatal(err)
	}
	return run
}

// step is the run's first step.
func (h *harness) step(id int64) model.Step {
	h.t.Helper()
	return h.run(id).Steps[0]
}

// stepOf is the run's step with that key.
func (h *harness) stepOf(id int64, key string) model.Step {
	h.t.Helper()
	run := h.run(id)
	s := run.Step(key)
	if s == nil {
		h.t.Fatalf("run %d has no step %s", id, key)
	}
	return *s
}

func (h *harness) observe(obs ...model.Obs) {
	h.t.Helper()
	if _, err := h.st.Observe(h.ctx, obs); err != nil {
		h.t.Fatal(err)
	}
}

// chain observes a version through tagged, built and published.
func (h *harness) chain(pkg, version string) {
	h.t.Helper()
	h.observe(model.Obs{Package: pkg, Version: version, Stage: model.Tagged, State: model.OK},
		model.Obs{Package: pkg, Version: version, Stage: model.Built, State: model.OK},
		model.Obs{Package: pkg, Version: version, Stage: model.Published, State: model.OK})
}
