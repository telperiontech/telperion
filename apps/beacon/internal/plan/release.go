package plan

import (
	"context"
	"fmt"
	"strings"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

// fireReleases fires the run's release steps that are triggering, grouped by
// repo and branch (same-repo batching): one repo lock and one read of the
// branch head per group, so the releases that became ready together tag the
// same commit. A step with NoBatch fires alone. Each step is still tracked
// and finished on its own.
func (r *Runner) fireReleases(ctx context.Context, w *world, run *model.Run) (bool, error) {
	groups := map[string][]*model.Step{}
	var order []string
	moved := false
	for j := range run.Steps {
		st := &run.Steps[j]
		if st.Type != model.StepRelease || st.State != model.StepTriggering {
			continue
		}
		before := *st
		p, ok := w.cat.Package(st.Package)
		if !ok {
			r.fail(w, st, "the package is no longer in the config")
		}
		if !ok || r.stalled(w, st) {
			m, err := r.save(ctx, run, before, st)
			if err != nil {
				return moved, err
			}
			moved = moved || m
			continue
		}
		key := p.Repo.URL + "\x00" + st.Branch
		if st.NoBatch {
			key += "\x00" + st.Key
		}
		if _, seen := groups[key]; !seen {
			order = append(order, key)
		}
		groups[key] = append(groups[key], st)
	}
	for _, key := range order {
		steps := groups[key]
		befores := make([]model.Step, len(steps))
		for i, st := range steps {
			befores[i] = *st
		}
		if err := r.fireGroup(ctx, w, run, steps); err != nil {
			return moved, err
		}
		for i, st := range steps {
			m, err := r.save(ctx, run, befores[i], st)
			if err != nil {
				return moved, err
			}
			moved = moved || m
		}
	}
	return moved, nil
}

// fireGroup fires releases of one repo and branch under one repo lock, all
// at the branch head as read now (it includes what the steps they need
// committed).
func (r *Runner) fireGroup(ctx context.Context, w *world, run *model.Run, steps []*model.Step) error {
	first := steps[0]
	p, _ := w.cat.Package(first.Package)
	lock := repoLock(p.Repo)
	ok, holder, err := r.Store.Lock(ctx, lock, run.ID, first.Key)
	if err != nil {
		return err
	}
	if !ok {
		for _, st := range steps {
			st.Detail = fmt.Sprintf("waits for the repo lock (run #%d is writing to it)", holder)
		}
		return nil
	}
	defer func() { _ = r.Store.Unlock(context.WithoutCancel(ctx), lock, run.ID, first.Key) }()

	refs, err := w.plat.Refs(ctx, p.Repo)
	if err != nil {
		for _, st := range steps {
			st.Detail = "cannot read the repo, retrying: " + err.Error()
		}
		return nil
	}
	_, commit, ok := refs.Head(first.Branch)
	if !ok {
		for _, st := range steps {
			r.fail(w, st, "the branch "+first.Branch+" was not found")
		}
		return nil
	}
	var fired []string
	for _, st := range steps {
		sp, _ := w.cat.Package(st.Package)
		if err := r.fireRelease(ctx, w, run, sp, st, refs, commit); err != nil {
			return err
		}
		if st.State == model.StepRunning && !st.Adopted {
			fired = append(fired, st.Tag)
		}
	}
	if len(fired) > 1 {
		return r.Store.Audit(ctx, "plan.batch", fmt.Sprintf("run %d", run.ID),
			fmt.Sprintf("%s at %s on %s", strings.Join(fired, ", "), short(commit), first.Branch))
	}
	return nil
}

func (r *Runner) fireRelease(ctx context.Context, w *world, run *model.Run, p catalog.Package, st *model.Step, refs adapter.Refs, commit string) error {
	trig, ok := w.plat.Trigger(p)
	if !ok {
		r.fail(w, st, "the package has no release trigger")
		return nil
	}
	if _, exists := refs.Tag(st.Tag); exists {
		st.Adopted, st.Detail = true, "the tag "+st.Tag+" exists; following it"
		if r.rerunFailedBuild(ctx, w, p, st) {
			r.running(w, st)
		}
		return nil
	}
	if !st.Fired.IsZero() && p.Release.GitHubRelease == nil {
		// Beacon stopped between storing the intent and the answer: the
		// dispatch or webhook may have gone out. Never send it twice.
		st.Detail = "Beacon restarted while firing; watching for the tag"
		r.running(w, st)
		return nil
	}
	st.Commit, st.Fired = commit, w.now
	if err := r.Store.SaveStep(ctx, run.ID, *st); err != nil {
		return err
	}
	fired, err := trig.Fire(ctx, adapter.ReleaseRequest{
		Package: p, Version: st.Version, Tag: st.Tag, Bump: st.Bump, Branch: st.Branch, Commit: commit, Plan: run.ID,
	})
	if err != nil {
		r.fail(w, st, "release: "+err.Error())
		return nil
	}
	st.URL, st.Detail, st.Adopted = fired.URL, fired.Detail, strings.HasPrefix(fired.Detail, "adopted")
	r.running(w, st)
	return nil
}

// rerunFailedBuild: an adopted tag whose build failed (e.g. a resumed
// release) has its failed jobs re-run, where the CI can; where it cannot,
// the step fails (re-run it in the CI, then resume). false: it failed.
func (r *Runner) rerunFailedBuild(ctx context.Context, w *world, p catalog.Package, st *model.Step) bool {
	if versionCells(p, w.states[p.Name], st.Version)[model.Built].State != model.Failed {
		return true
	}
	rr, ok := w.plat.Rerunner(p)
	if !ok {
		r.fail(w, st, "the build of "+st.Tag+" failed and Beacon cannot re-run it; re-run it in the CI, then resume")
		return false
	}
	fired, err := rr.Rerun(ctx, p, st.Tag)
	if err != nil {
		r.fail(w, st, "re-running the failed build of "+st.Tag+": "+err.Error())
		return false
	}
	st.URL, st.Detail = fired.URL, "the tag "+st.Tag+" exists and its build failed: re-ran the failed jobs"
	return true
}

func short(sha string) string {
	if len(sha) > 7 {
		return sha[:7]
	}
	return sha
}
