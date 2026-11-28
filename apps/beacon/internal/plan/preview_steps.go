package plan

import (
	"context"
	"fmt"
	"strings"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/observe"
	"github.com/telperiontech/telperion/apps/beacon/internal/semver"
)

func (pl *planner) release(ctx context.Context, p catalog.Package, ps model.PlanStep) {
	trig, ok := pl.plat.Trigger(p)
	if !ok {
		pl.fail("%s: %s has no release trigger (set release: in the config)", ps.Key, p.Name)
		return
	}
	if ps.Version == "" && !semver.Bump(ps.Bump).Valid() {
		pl.fail("%s: choose major, minor or patch", ps.Key)
		return
	}
	refs, err := pl.repoRefs(ctx, p.Repo)
	if err != nil {
		pl.fail("%s: cannot read the refs of %s: %v", ps.Key, p.Repo.URL, err)
		return
	}
	m, err := catalog.NewTagMatcher(p.Tag, p.Name)
	if err != nil {
		pl.fail("%s: tag pattern: %v", ps.Key, err)
		return
	}
	latestTag := observe.LatestTag(refs, m)
	latest, _ := m.Version(latestTag)
	version := ps.Version
	if version == "" {
		version, _ = semver.Next(latest, semver.Bump(ps.Bump))
	} else if _, ok := semver.Parse(version); !ok {
		pl.fail("%s: %q is not a semantic version", ps.Key, version)
		return
	}
	branch, commit, ok := refs.Head(p.Branch)
	if !ok {
		pl.fail("%s: the branch %q of %s was not found", ps.Key, branch, p.Repo.URL)
		return
	}
	if len(ps.Needs) > 0 {
		commit = "" // the head when it fires, with what the steps it needs committed
	}
	until := ps.Until
	if until == "" {
		until = lastStage(p)
	}
	tag := m.Tag(version)
	_, exists := refs.Tag(tag)
	sp := StepPreview{Step: model.Step{
		Type: model.StepRelease, Package: p.Name, Bump: ps.Bump, Version: version, From: latest,
		Tag: tag, Until: until, Branch: branch, Commit: commit, Adopted: exists, NoBatch: ps.NoBatch,
	}}
	if ps.Version != "" {
		sp.Bump = string(semver.Kind(latest, version))
	}
	switch {
	case exists:
		sp.Action = "follow the existing tag " + tag + " (nothing is created)"
		pl.warn("%s: the tag %s exists already: Beacon follows its chain instead of releasing again", ps.Key, tag)
	default:
		sp.Action = trig.Describe(adapter.ReleaseRequest{Package: p, Version: version, Tag: tag, Bump: sp.Bump, Branch: branch, Commit: commit})
		sp.Major = semver.Kind(latest, version) == semver.Major
		if latest != "" && semver.CompareStrings(version, latest) <= 0 {
			pl.warn("%s: %s is not newer than the latest release %s", ps.Key, version, latest)
		}
	}
	if n, ok := pl.unreleased[p.Name]; ok && n.Tag == latestTag {
		sp.Unreleased = &n.Commits
		if n.Commits == 0 && !exists && !pl.updatedInPlan(p.Name) {
			pl.warn("%s: %s has no changes since %s", ps.Key, p.Name, latestTag)
		}
	}
	pl.versions[p.Name] = version
	pl.add(ps, sp)
}

// updatedInPlan reports whether an update-deps step before this one writes to
// the package (so a release without other changes is expected).
func (pl *planner) updatedInPlan(pkg string) bool {
	for _, s := range pl.preview.Steps {
		if s.Type == model.StepUpdateDeps && s.Package == pkg {
			return true
		}
	}
	return false
}

func (pl *planner) updateDeps(ctx context.Context, p catalog.Package, ps model.PlanStep) {
	com, ok := pl.plat.Committer(p)
	if !ok {
		pl.fail("%s: writing to %s needs the GitHub App", ps.Key, p.Repo.URL)
		return
	}
	refs, err := pl.repoRefs(ctx, p.Repo)
	if err != nil {
		pl.fail("%s: cannot read the refs of %s: %v", ps.Key, p.Repo.URL, err)
		return
	}
	branch, _, ok := refs.Head(p.Branch)
	if !ok {
		pl.fail("%s: the branch %q of %s was not found", ps.Key, branch, p.Repo.URL)
		return
	}
	sp := StepPreview{Step: model.Step{Type: model.StepUpdateDeps, Package: p.Name, Branch: branch, Via: ps.Via, File: manifestPath(p)}}
	if sp.Via == "" {
		sp.Via = model.ViaCommit
	}
	f, err := com.ReadFile(ctx, p.Repo, branch, sp.File)
	if err != nil {
		pl.fail("%s: %v", ps.Key, err)
		return
	}
	deps := make([]model.DepChange, 0, len(ps.Deps))
	for _, name := range ps.Deps {
		dep, _ := pl.cat.Package(name) // CheckPlan found it, with an npm artifact
		v := pl.versions[name]
		if v == "" {
			v = latestPublished(dep, pl.states[name])
		}
		if v == "" {
			pl.fail("%s: %s has no published version to depend on", ps.Key, name)
			return
		}
		deps = append(deps, model.DepChange{Package: name, Name: dep.Artifact.NPM.Name, Version: v})
	}
	changed, notes, err := setRanges(f.Content, deps)
	if err != nil {
		pl.fail("%s: %s: %v", ps.Key, sp.File, err)
		return
	}
	for _, n := range notes {
		pl.warn("%s: %s", ps.Key, n)
	}
	sp.Deps = deps
	sp.Action = describeDeps(sp.Step, changed != nil)
	sp.Adopted = changed == nil
	pl.add(ps, sp)
}

func (pl *planner) deploy(p catalog.Package, ps model.PlanStep) {
	target, ok := pl.cat.Target(ps.Target)
	if _, _, can := pl.plat.Deployer(p, ps.Target); !can {
		pl.fail("%s: %s cannot be deployed to %q (only Coolify targets of the package can)", ps.Key, p.Name, ps.Target)
		return
	}
	version, planned := ps.Version, false
	if version == "" {
		version, planned = pl.versions[p.Name], pl.versions[p.Name] != ""
	}
	if version == "" {
		version = latestPublished(p, pl.states[p.Name])
	}
	if _, valid := semver.Parse(version); !valid {
		pl.fail("%s: %q is not a semantic version (and %s has no published version)", ps.Key, version, p.Name)
		return
	}
	running := pl.running(p, ps.Target)
	sp := StepPreview{Step: model.Step{
		Type: model.StepDeploy, Package: p.Name, Version: version, From: running,
		Target: ps.Target, Until: model.Deployed, Adopted: running == version,
	}}
	sp.Action = fmt.Sprintf("deploy %s %s on %s", p.Name, version, ps.Target)
	if running != "" {
		sp.Action += " (runs " + running + " now)"
	}
	if sp.Adopted {
		pl.warn("%s: %s runs %s already: nothing is deployed", ps.Key, ps.Target, version)
	}
	if c, has := pl.cells(p, version)[model.Published]; has && c.State != model.OK && !planned {
		pl.warn("%s: %s %s is not published (its published stage is %s)", ps.Key, p.Name, version, c.State)
	}
	if ok && target.Limit < 1 {
		pl.fail("%s: target %s has no deploy slots", ps.Key, ps.Target)
	}
	pl.add(ps, sp)
}

func (pl *planner) rerun(p catalog.Package, ps model.PlanStep) {
	if _, ok := pl.plat.Rerunner(p); !ok {
		pl.fail("%s's CI cannot be re-run (needs GitHub Actions and the GitHub App)", p.Name)
		return
	}
	if c := pl.cells(p, ps.Version)[model.Built]; c.State != model.Failed {
		pl.fail("the build of %s %s is not failed (it is %s)", p.Name, ps.Version, c.State)
		return
	}
	m, _ := catalog.NewTagMatcher(p.Tag, p.Name)
	sp := StepPreview{Step: model.Step{
		Type: model.StepRerun, Package: p.Name, Version: ps.Version, Tag: m.Tag(ps.Version), Until: lastStage(p),
	}}
	sp.Action = fmt.Sprintf("re-run the failed jobs of %s for %s", p.CI.GitHubActions.Workflow, sp.Tag)
	pl.add(ps, sp)
}

// actionTitle names a one-click action's run.
func actionTitle(s model.Step) string {
	switch s.Type {
	case model.StepRelease:
		t := fmt.Sprintf("release %s %s", s.Package, s.Version)
		if s.Bump != "" {
			t += " (" + s.Bump + ")"
		}
		return t
	case model.StepDeploy:
		return fmt.Sprintf("deploy %s %s on %s", s.Package, s.Version, s.Target)
	}
	return fmt.Sprintf("re-run the build of %s %s", s.Package, s.Version)
}

// describeDeps says what an update-deps step writes.
func describeDeps(s model.Step, changes bool) string {
	if !changes {
		return fmt.Sprintf("nothing to write: %s has these ranges already", s.File)
	}
	var parts []string
	for _, d := range s.Deps {
		if d.From != "" && d.From != d.To {
			parts = append(parts, fmt.Sprintf("%s %s → %s", d.Name, d.From, d.To))
		}
	}
	where := "commit to " + s.Branch
	if s.Via == model.ViaPR {
		where = "open a pull request into " + s.Branch + " and wait for its merge"
	}
	return fmt.Sprintf("%s: %s, %s", where, s.File, strings.Join(parts, ", "))
}
