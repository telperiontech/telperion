package plan

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/observe"
	"github.com/telperiontech/telperion/apps/beacon/internal/semver"
	"github.com/telperiontech/telperion/apps/beacon/internal/store"
)

// Preview is a plan as it would run, computed with no writes by the same
// code that runs it. Start computes it again and refuses when it moved.
type Preview struct {
	Request  Request       `json:"request"`
	Title    string        `json:"title"`
	Steps    []StepPreview `json:"steps"`
	Errors   []string      `json:"errors"`   // the plan cannot start
	Warnings []string      `json:"warnings"` // it can, but look first
	Major    bool          `json:"major"`    // a major version change: confirmed separately
	// Fingerprint changes whenever anything the user confirms changes.
	Fingerprint string `json:"fingerprint"`
}

// StepPreview is one step as it would run.
type StepPreview struct {
	model.Step
	Action     string   `json:"action"` // what it does, in words
	Major      bool     `json:"major,omitempty"`
	Unreleased *int     `json:"unreleased,omitempty"` // commits since the latest tag
	Waits      []string `json:"waits,omitempty"`      // locks and limits it would wait for
}

// planner reads the world once for a preview.
type planner struct {
	env     Env
	cat     catalog.Catalog
	plat    Platform
	states  map[string]*store.PackageState
	active  []model.Run
	preview *Preview
}

// Preview computes what req would do. The error is for a failure to read the
// world; a request that cannot run has Errors.
func (e Env) Preview(ctx context.Context, req Request) (Preview, error) {
	pl, err := e.planner(ctx, req)
	if err != nil {
		return Preview{}, err
	}
	return pl.run(ctx, req), nil
}

func (e Env) planner(ctx context.Context, req Request) (*planner, error) {
	c, err := e.Store.LoadCatalog(ctx)
	if err != nil {
		return nil, err
	}
	plat, err := e.Platform(c)
	if err != nil {
		return nil, err
	}
	states, err := e.Store.States(ctx, req.Package)
	if err != nil {
		return nil, err
	}
	active, err := e.Store.ActiveRuns(ctx)
	if err != nil {
		return nil, err
	}
	return &planner{env: e, cat: c, plat: plat, states: states, active: active,
		preview: &Preview{Request: req, Errors: []string{}, Warnings: []string{}, Steps: []StepPreview{}}}, nil
}

func (pl *planner) run(ctx context.Context, req Request) Preview {
	p, ok := pl.cat.Package(req.Package)
	switch {
	case !ok:
		pl.fail("unknown package %q", req.Package)
	case req.Kind == model.StepRelease:
		pl.release(ctx, p, req)
	case req.Kind == model.StepDeploy:
		pl.deploy(p, req)
	case req.Kind == model.StepRerun:
		pl.rerun(p, req)
	default:
		pl.fail("unknown action %q (release, deploy or rerun)", req.Kind)
	}
	out := pl.preview
	for _, s := range out.Steps {
		out.Major = out.Major || s.Major
	}
	out.Fingerprint = fingerprint(out)
	return *out
}

func (pl *planner) fail(format string, args ...any) {
	pl.preview.Errors = append(pl.preview.Errors, fmt.Sprintf(format, args...))
}

func (pl *planner) warn(format string, args ...any) {
	pl.preview.Warnings = append(pl.preview.Warnings, fmt.Sprintf(format, args...))
}

func (pl *planner) add(sp StepPreview) {
	sp.State = model.StepReady
	sp.Waits = pl.waits(sp.Step)
	pl.preview.Steps = append(pl.preview.Steps, sp)
}

func (pl *planner) release(ctx context.Context, p catalog.Package, req Request) {
	trig, ok := pl.plat.Trigger(p)
	if !ok {
		pl.fail("%s has no release trigger (set release: in the config)", p.Name)
		return
	}
	if req.Version == "" && !semver.Bump(req.Bump).Valid() {
		pl.fail("choose major, minor or patch")
		return
	}
	refs, err := pl.plat.Refs(ctx, p.Repo)
	if err != nil {
		pl.fail("cannot read the refs of %s: %v", p.Repo.URL, err)
		return
	}
	m, err := catalog.NewTagMatcher(p.Tag, p.Name)
	if err != nil {
		pl.fail("tag pattern: %v", err)
		return
	}
	latestTag := observe.LatestTag(refs, m)
	latest, _ := m.Version(latestTag)
	version := req.Version
	if version == "" {
		version, _ = semver.Next(latest, semver.Bump(req.Bump))
	} else if _, ok := semver.Parse(version); !ok {
		pl.fail("%q is not a semantic version", version)
		return
	}
	branch, commit, ok := refs.Head(p.Branch)
	if !ok {
		pl.fail("the branch %q of %s was not found", branch, p.Repo.URL)
		return
	}
	tag := m.Tag(version)
	_, exists := refs.Tag(tag)
	sp := StepPreview{Step: model.Step{
		Key: p.Name, Type: model.StepRelease, Package: p.Name, Bump: req.Bump, Version: version, From: latest,
		Tag: tag, Until: lastStage(p), Branch: branch, Commit: commit, Adopted: exists,
	}}
	if req.Version != "" {
		sp.Bump = string(semver.Kind(latest, version))
	}
	switch {
	case exists:
		sp.Action = "follow the existing tag " + tag + " (nothing is created)"
		pl.warn("the tag %s exists already: Beacon follows its chain instead of releasing again", tag)
	default:
		sp.Action = trig.Describe(adapter.ReleaseRequest{Package: p, Version: version, Tag: tag, Bump: sp.Bump, Branch: branch, Commit: commit})
		sp.Major = semver.Kind(latest, version) == semver.Major
		if latest != "" && semver.CompareStrings(version, latest) <= 0 {
			pl.warn("%s is not newer than the latest release %s", version, latest)
		}
	}
	if u, err := pl.env.Store.Unreleased(ctx); err == nil {
		if n, ok := u[p.Name]; ok && n.Tag == latestTag {
			sp.Unreleased = &n.Commits
			if n.Commits == 0 && !exists {
				pl.warn("%s has no changes since %s", p.Name, latestTag)
			}
		}
	}
	pl.preview.Title = fmt.Sprintf("release %s %s", p.Name, version)
	if sp.Bump != "" {
		pl.preview.Title += " (" + sp.Bump + ")"
	}
	pl.add(sp)
}

func (pl *planner) deploy(p catalog.Package, req Request) {
	target, ok := pl.cat.Target(req.Target)
	if _, _, can := pl.plat.Deployer(p, req.Target); !can {
		pl.fail("%s cannot be deployed to %q (only Coolify targets of the package can)", p.Name, req.Target)
		return
	}
	if _, valid := semver.Parse(req.Version); !valid {
		pl.fail("%q is not a semantic version", req.Version)
		return
	}
	cells := pl.cells(p, req.Version)
	running := pl.running(p, req.Target)
	sp := StepPreview{Step: model.Step{
		Key: p.Name + "@" + req.Target, Type: model.StepDeploy, Package: p.Name, Version: req.Version, From: running,
		Target: req.Target, Until: model.Deployed, Adopted: running == req.Version,
	}}
	sp.Action = fmt.Sprintf("deploy %s %s on %s", p.Name, req.Version, req.Target)
	if running != "" {
		sp.Action += " (runs " + running + " now)"
	}
	if sp.Adopted {
		pl.warn("%s runs %s already: nothing is deployed", req.Target, req.Version)
	}
	if c, has := cells[model.Published]; has && c.State != model.OK {
		pl.warn("%s %s is not published (its published stage is %s)", p.Name, req.Version, c.State)
	}
	if ok && target.Limit < 1 {
		pl.fail("target %s has no deploy slots", req.Target)
	}
	pl.preview.Title = fmt.Sprintf("deploy %s %s on %s", p.Name, req.Version, req.Target)
	pl.add(sp)
}

func (pl *planner) rerun(p catalog.Package, req Request) {
	if _, ok := pl.plat.Rerunner(p); !ok {
		pl.fail("%s's CI cannot be re-run (needs GitHub Actions and the GitHub App)", p.Name)
		return
	}
	cells := pl.cells(p, req.Version)
	if c := cells[model.Built]; c.State != model.Failed {
		pl.fail("the build of %s %s is not failed (it is %s)", p.Name, req.Version, c.State)
		return
	}
	m, _ := catalog.NewTagMatcher(p.Tag, p.Name)
	sp := StepPreview{Step: model.Step{
		Key: p.Name, Type: model.StepRerun, Package: p.Name, Version: req.Version, Tag: m.Tag(req.Version), Until: lastStage(p),
	}}
	sp.Action = fmt.Sprintf("re-run the failed jobs of %s for %s", p.CI.GitHubActions.Workflow, sp.Tag)
	pl.preview.Title = fmt.Sprintf("re-run the build of %s %s", p.Name, req.Version)
	pl.add(sp)
}

// cells are the package's cells for one version (empty if unknown).
func (pl *planner) cells(p catalog.Package, version string) map[model.Stage]model.Cell {
	return versionCells(p, pl.states[p.Name], version)
}

// running is the version the package runs on a target ("" if unknown).
func (pl *planner) running(p catalog.Package, target string) string {
	ps := pl.states[p.Name]
	if ps == nil {
		return ""
	}
	for _, r := range ps.Rows {
		if r.Stage == model.Deployed && r.Target == target && r.State == model.OK {
			return r.Version
		}
	}
	return ""
}

// waits lists what an active run holds that this step would wait for.
func (pl *planner) waits(st model.Step) []string {
	var out []string
	for _, r := range pl.active {
		for _, o := range r.Steps {
			if o.State.Terminal() {
				continue
			}
			if o.Package == st.Package {
				out = append(out, fmt.Sprintf("run #%d has an active step on %s", r.ID, st.Package))
			}
		}
	}
	if st.Type == model.StepDeploy {
		if t, ok := pl.cat.Target(st.Target); ok && busyOn(pl.active, st.Target, -1, "") >= t.Limit {
			out = append(out, fmt.Sprintf("%s deploys %d at a time", st.Target, t.Limit))
		}
	}
	return out
}

// busyOn counts the deploy steps on target that are triggering or running,
// leaving out one step (run, key).
func busyOn(runs []model.Run, target string, run int64, key string) int {
	n := 0
	for _, r := range runs {
		for _, s := range r.Steps {
			if s.Type == model.StepDeploy && s.Target == target && (r.ID != run || s.Key != key) &&
				(s.State == model.StepTriggering || s.State == model.StepRunning) {
				n++
			}
		}
	}
	return n
}

// versionCells computes the chain cells of one version of a package.
func versionCells(p catalog.Package, ps *store.PackageState, version string) map[model.Stage]model.Cell {
	if ps == nil {
		return map[model.Stage]model.Cell{}
	}
	for _, vc := range model.Cells(p.Chain(), p.Targets(), ps.Versions, ps.Rows) {
		if vc.Version == version {
			return vc.Cells
		}
	}
	return map[model.Stage]model.Cell{}
}

func fingerprint(p *Preview) string {
	type key struct {
		Type                                        model.StepType
		Package, Version, Tag, Commit, Target, From string
		Adopted                                     bool
	}
	keys := make([]key, 0, len(p.Steps))
	for _, s := range p.Steps {
		keys = append(keys, key{s.Type, s.Package, s.Version, s.Tag, s.Commit, s.Target, s.From, s.Adopted})
	}
	b, _ := json.Marshal([]any{keys, p.Errors})
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:12])
}
