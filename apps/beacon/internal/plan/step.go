package plan

import (
	"context"
	"fmt"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

// advance moves one step by at most one state. Release steps in triggering
// are fired by fireReleases instead. Errors are the store's; a platform error
// fails the step or leaves it to try again.
func (r *Runner) advance(ctx context.Context, w *world, run *model.Run, st *model.Step) error {
	p, ok := w.cat.Package(st.Package)
	if !ok && !st.State.Terminal() {
		r.fail(w, st, "the package is no longer in the config")
		return nil
	}
	switch st.State {
	case model.StepWaiting:
		r.waiting(w, run, st)
	case model.StepReady, model.StepBlocked:
		return r.acquire(ctx, w, run, st)
	case model.StepTriggering:
		return r.fire(ctx, w, run, p, st)
	case model.StepRunning:
		r.watch(ctx, w, run, p, st)
	case model.StepPaused:
		r.watchPR(ctx, w, run, p, st)
	}
	return nil
}

// waiting: ready when every need is done; skipped when one cannot be.
func (r *Runner) waiting(w *world, run *model.Run, st *model.Step) {
	for _, key := range st.Needs {
		need := run.Step(key)
		switch {
		case need == nil || need.State == model.StepFailed || need.State == model.StepSkipped || need.State == model.StepCancelled:
			st.State, st.Detail, st.Finished = model.StepSkipped, "a step it needs did not finish: "+key, w.now
			return
		case need.State != model.StepDone:
			return
		}
	}
	st.State, st.Detail = model.StepReady, ""
}

// acquire takes the package lock and, for a deploy, a slot on its target.
func (r *Runner) acquire(ctx context.Context, w *world, run *model.Run, st *model.Step) error {
	ok, holder, err := r.Store.Lock(ctx, packageLock(st.Package), run.ID, st.Key)
	if err != nil {
		return err
	}
	if !ok {
		st.State, st.Detail = model.StepBlocked, fmt.Sprintf("waits for run #%d (it has an active step on %s)", holder, st.Package)
		if holder == run.ID {
			st.Detail = fmt.Sprintf("waits for another step of this run on %s", st.Package)
		}
		return nil
	}
	if st.Type == model.StepDeploy {
		if t, ok := w.cat.Target(st.Target); ok && busyOn(w.runs, st.Target, run.ID, st.Key) >= t.Limit {
			st.State, st.Detail = model.StepBlocked, fmt.Sprintf("waits for a free slot on %s (%d at a time)", st.Target, t.Limit)
			return nil
		}
	}
	st.State, st.Detail, st.Progress = model.StepTriggering, "", w.now
	return nil
}

// fire starts what the step does, after checking that its result does not
// exist already. The intent (fire time) is stored before the write, so a
// restart in between does not fire a second time.
func (r *Runner) fire(ctx context.Context, w *world, run *model.Run, p catalog.Package, st *model.Step) error {
	if r.stalled(w, st) {
		return nil
	}
	switch st.Type {
	case model.StepUpdateDeps:
		return r.fireUpdateDeps(ctx, w, run, p, st)
	case model.StepDeploy:
		return r.fireDeploy(ctx, w, run, p, st)
	case model.StepRerun:
		rr, ok := w.plat.Rerunner(p)
		if !ok {
			r.fail(w, st, "the package's CI cannot be re-run")
			return nil
		}
		fired, err := rr.Rerun(ctx, p, st.Tag)
		if err != nil {
			r.fail(w, st, "re-run: "+err.Error())
			return nil
		}
		st.URL, st.Detail = fired.URL, fired.Detail
		r.running(w, st)
	}
	return nil
}

// stalled fails a step that could not fire for StallTimeout.
func (r *Runner) stalled(w *world, st *model.Step) bool {
	if w.now.Sub(later(st.Fired, st.Progress)) <= StallTimeout {
		return false
	}
	r.fail(w, st, "could not fire for "+StallTimeout.String()+": "+st.Detail)
	return true
}

func (r *Runner) fireDeploy(ctx context.Context, w *world, run *model.Run, p catalog.Package, st *model.Step) error {
	dep, d, ok := w.plat.Deployer(p, st.Target)
	if !ok {
		r.fail(w, st, "the target cannot be deployed to")
		return nil
	}
	if targetCell(w, p, st).State == model.OK {
		st.Adopted, st.Detail = true, st.Target+" runs "+st.Version+" already"
		r.running(w, st)
		return nil
	}
	if !st.Fired.IsZero() {
		st.Detail = "Beacon restarted while deploying; following the target"
		r.running(w, st)
		return nil
	}
	st.Fired = w.now
	if err := r.Store.SaveStep(ctx, run.ID, *st); err != nil {
		return err
	}
	ref, err := dep.Deploy(ctx, p.Name, d, st.Version)
	if err != nil {
		r.fail(w, st, "deploy: "+err.Error())
		return nil
	}
	st.DeployID, st.URL, st.Adopted = ref.ID, ref.URL, ref.ID == ""
	st.Detail = "deployment started"
	if st.Adopted {
		st.Detail = st.Target + " runs " + st.Version + " already"
	}
	r.running(w, st)
	return nil
}

func (r *Runner) running(w *world, st *model.Step) {
	st.State, st.Progress = model.StepRunning, w.now
	if st.Fired.IsZero() {
		st.Fired = w.now
	}
	r.wake(st.Package)
}

// watch decides a running step from observations.
func (r *Runner) watch(ctx context.Context, w *world, run *model.Run, p catalog.Package, st *model.Step) {
	if st.Type == model.StepDeploy {
		r.watchDeploy(ctx, w, run, p, st)
	} else {
		r.watchChain(w, p, st, versionCells(p, w.states[p.Name], st.Version))
	}
	if !st.State.Terminal() && w.now.Sub(later(st.Fired, st.Progress)) > StallTimeout {
		r.fail(w, st, "no progress for "+StallTimeout.String())
	}
}

// watchChain: done when the Until stage is ok; failed when a stage on the way
// failed after the step fired (a re-run starts from a failed build).
func (r *Runner) watchChain(w *world, p catalog.Package, st *model.Step, cells map[model.Stage]model.Cell) {
	if c := cells[st.Until]; c.State == model.OK {
		r.done(w, st, string(st.Until)+" "+st.Version)
		return
	}
	for _, stage := range p.Chain() {
		c := cells[stage]
		if c.State == "" {
			c.State = model.Missing // a version not seen yet
		}
		if c.Since.After(st.Progress) && c.State != model.Missing {
			st.Progress = c.Since
		}
		if c.State == model.Failed && !c.Since.Before(st.Fired.Truncate(time.Second)) {
			r.fail(w, st, fmt.Sprintf("%s failed: %s", stage, c.Detail))
			return
		}
		if c.State != model.OK {
			st.Detail = fmt.Sprintf("%s: %s", stage, c.State)
			if c.State == model.Missing && stage == model.Tagged && w.now.Sub(st.Fired) > TagTimeout {
				r.fail(w, st, "the tag "+st.Tag+" did not appear within "+TagTimeout.String())
			}
			return
		}
		if stage == st.Until {
			return
		}
	}
}

// watchDeploy: done when the target runs the version; the deployment's own
// status is asked every StatusEvery for failures and progress.
func (r *Runner) watchDeploy(ctx context.Context, w *world, run *model.Run, p catalog.Package, st *model.Step) {
	if targetCell(w, p, st).State == model.OK {
		r.done(w, st, st.Target+" runs "+st.Version)
		return
	}
	key := statusKey(run.ID, st.Key)
	if w.now.Sub(r.lastStatus[key]) < r.StatusEvery {
		return
	}
	r.lastStatus[key] = w.now
	dep, d, ok := w.plat.Deployer(p, st.Target)
	if !ok {
		r.fail(w, st, "the target cannot be deployed to")
		return
	}
	state, detail, err := dep.DeployStatus(ctx, d, adapter.DeployRef{ID: st.DeployID, URL: st.URL})
	switch {
	case err != nil:
		st.Detail = "cannot read the deployment, retrying: " + err.Error()
	case state == model.Failed:
		r.fail(w, st, "deployment "+detail)
	case state == model.OK:
		st.Detail = "deployment " + detail + "; waiting for " + st.Target + " to report " + st.Version
		r.wake(st.Package)
	default:
		st.Detail, st.Progress = "deployment "+detail, w.now
	}
}

func targetCell(w *world, p catalog.Package, st *model.Step) model.TargetCell {
	for _, t := range versionCells(p, w.states[p.Name], st.Version)[model.Deployed].Targets {
		if t.Target == st.Target {
			return t
		}
	}
	return model.TargetCell{State: model.Missing}
}

func (r *Runner) done(w *world, st *model.Step, detail string) {
	st.State, st.Detail, st.Finished = model.StepDone, detail, w.now
	if st.Fired.IsZero() {
		st.Fired = w.now
	}
}

func (r *Runner) fail(w *world, st *model.Step, detail string) {
	st.State, st.Detail, st.Finished = model.StepFailed, detail, w.now
}

func later(a, b time.Time) time.Time {
	if a.After(b) {
		return a
	}
	return b
}
