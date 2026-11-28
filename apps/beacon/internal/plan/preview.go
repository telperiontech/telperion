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
	"github.com/telperiontech/telperion/apps/beacon/internal/semver"
	"github.com/telperiontech/telperion/apps/beacon/internal/store"
)

// Preview is a plan as it would run, computed with no writes by the same
// code that runs it. Start computes it again and refuses when it moved.
type Preview struct {
	Request  Request       `json:"request"`
	Title    string        `json:"title"`
	Recipe   string        `json:"recipe,omitempty"`
	FailFast bool          `json:"failFast,omitempty"`
	Plan     *model.Plan   `json:"plan,omitempty"` // the plan previewed (nil when it could not be read)
	Steps    []StepPreview `json:"steps"`          // in run order: each after its needs
	Errors   []string      `json:"errors"`         // the plan cannot start
	Warnings []string      `json:"warnings"`       // it can, but look first
	Major    bool          `json:"major"`          // a major version change: confirmed separately
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
	env        Env
	cat        catalog.Catalog
	plat       Platform
	states     map[string]*store.PackageState
	active     []model.Run
	unreleased map[string]model.Unreleased
	refs       map[string]adapter.Refs // by repo URL
	versions   map[string]string       // package → the version a release step of the plan reaches
	preview    *Preview
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
	states, err := e.Store.States(ctx, "")
	if err != nil {
		return nil, err
	}
	active, err := e.Store.ActiveRuns(ctx)
	if err != nil {
		return nil, err
	}
	unreleased, err := e.Store.Unreleased(ctx)
	if err != nil {
		return nil, err
	}
	return &planner{env: e, cat: c, plat: plat, states: states, active: active, unreleased: unreleased,
		refs: map[string]adapter.Refs{}, versions: map[string]string{},
		preview: &Preview{Request: req, Errors: []string{}, Warnings: []string{}, Steps: []StepPreview{}}}, nil
}

func (pl *planner) run(ctx context.Context, req Request) Preview {
	out := pl.preview
	p, recipe, err := req.plan(pl.cat)
	if err != nil {
		pl.fail("%v", err)
		return pl.finish()
	}
	out.Plan, out.Recipe, out.FailFast = &p, recipe, p.FailFast
	if req.action() {
		pl.action(ctx, p.Steps[0])
		return pl.finish()
	}
	out.Title = planTitle(p)
	if errs := pl.cat.CheckPlan(p); len(errs) > 0 {
		out.Errors = append(out.Errors, errs...)
		return pl.finish()
	}
	ordered, _ := p.Order()
	for _, ps := range ordered {
		pl.step(ctx, ps)
	}
	return pl.finish()
}

// action previews a one-click action, with the checks CheckPlan does for
// plans (an action may also be a re-run, which plans do not have).
func (pl *planner) action(ctx context.Context, ps model.PlanStep) {
	p, ok := pl.cat.Package(ps.Package)
	switch {
	case !ok:
		pl.fail("unknown package %q", ps.Package)
	case ps.Type == model.StepRelease:
		pl.release(ctx, p, ps)
	case ps.Type == model.StepDeploy:
		pl.deploy(p, ps)
	case ps.Type == model.StepRerun:
		pl.rerun(p, ps)
	default:
		pl.fail("unknown action %q (release, deploy or rerun)", ps.Type)
	}
	if len(pl.preview.Steps) == 1 {
		pl.preview.Title = actionTitle(pl.preview.Steps[0].Step)
	}
}

func (pl *planner) step(ctx context.Context, ps model.PlanStep) {
	p, _ := pl.cat.Package(ps.Package) // CheckPlan found it
	switch ps.Type {
	case model.StepRelease:
		pl.release(ctx, p, ps)
	case model.StepUpdateDeps:
		pl.updateDeps(ctx, p, ps)
	case model.StepDeploy:
		pl.deploy(p, ps)
	}
}

func (pl *planner) finish() Preview {
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

// add appends a step: waiting when it has needs, ready otherwise.
func (pl *planner) add(ps model.PlanStep, sp StepPreview) {
	sp.Key, sp.Needs, sp.State = ps.Key, ps.Needs, model.StepReady
	if len(ps.Needs) > 0 {
		sp.State = model.StepWaiting
	}
	sp.Waits = pl.waits(sp.Step)
	pl.preview.Steps = append(pl.preview.Steps, sp)
}

// repoRefs reads a repo's refs once per preview.
func (pl *planner) repoRefs(ctx context.Context, repo catalog.Repo) (adapter.Refs, error) {
	if r, ok := pl.refs[repo.URL]; ok {
		return r, nil
	}
	r, err := pl.plat.Refs(ctx, repo)
	if err == nil {
		pl.refs[repo.URL] = r
	}
	return r, err
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
			if !o.State.Terminal() && o.Package == st.Package {
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

// latestPublished is the highest version of a package that is published (or
// tagged, for a package without an artifact): what a dependency range or a
// deploy uses when the plan does not release the package.
func latestPublished(p catalog.Package, ps *store.PackageState) string {
	if ps == nil {
		return ""
	}
	stage := model.Published
	if p.Artifact == nil {
		stage = model.Tagged
	}
	var versions []string
	for _, r := range ps.Rows {
		if r.Stage == stage && r.State == model.OK {
			versions = append(versions, r.Version)
		}
	}
	return semver.Latest(versions)
}

func fingerprint(p *Preview) string {
	type key struct {
		Key                                         string
		Type                                        model.StepType
		Package, Version, Tag, Commit, Target, From string
		Adopted                                     bool
		Needs                                       []string
		Deps                                        []model.DepChange
		Via                                         model.Via
	}
	keys := make([]key, 0, len(p.Steps))
	for _, s := range p.Steps {
		keys = append(keys, key{s.Key, s.Type, s.Package, s.Version, s.Tag, s.Commit, s.Target, s.From, s.Adopted, s.Needs, s.Deps, s.Via})
	}
	b, _ := json.Marshal([]any{keys, p.Errors, p.FailFast})
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:12])
}
