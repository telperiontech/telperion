package plan

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"path"
	"strings"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/manifest"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
)

// manifestPath is the package.json an update-deps step edits.
func manifestPath(p catalog.Package) string { return path.Join(p.Path, "package.json") }

// setRanges fills each dependency's From and To (^<version>) from the
// manifest and returns the new content, or nil when nothing changes. notes
// say which dependencies are left alone, and why.
func setRanges(content []byte, deps []model.DepChange) ([]byte, []string, error) {
	names := make([]string, len(deps))
	for i, d := range deps {
		names[i] = d.Name
	}
	ranges, err := manifest.Ranges(content, names...)
	if err != nil {
		return nil, nil, err
	}
	want := map[string]string{}
	var notes []string
	for i, r := range ranges {
		d := &deps[i]
		d.From, d.To = r.Range, ""
		switch {
		case r.Range == "":
			notes = append(notes, fmt.Sprintf("the manifest does not depend on %s; nothing is set", d.Name))
		case !r.Plain:
			notes = append(notes, fmt.Sprintf("%s is %q, not a version range; left as it is", d.Name, r.Range))
		default:
			d.To = "^" + d.Version
			want[d.Name] = d.To
		}
	}
	out := manifest.Set(content, want)
	if bytes.Equal(out, content) {
		return nil, notes, nil
	}
	return out, notes, nil
}

// fireUpdateDeps writes the dependency ranges, under the repo lock: a commit
// on the branch (done at once), or a pull request (paused until merged). The
// ranges are computed again from the file as it is now; a file that has them
// already is adopted.
func (r *Runner) fireUpdateDeps(ctx context.Context, w *world, run *model.Run, p catalog.Package, st *model.Step) error {
	com, ok := w.plat.Committer(p)
	if !ok {
		r.fail(w, st, "writing to the repo needs the GitHub App")
		return nil
	}
	if st.PR != 0 {
		st.State, st.Detail = model.StepPaused, fmt.Sprintf("waiting for pull request #%d to be merged", st.PR)
		return nil
	}
	ok, holder, err := r.Store.Lock(ctx, repoLock(p.Repo), run.ID, st.Key)
	if err != nil {
		return err
	}
	if !ok {
		st.Detail = fmt.Sprintf("waits for the repo lock (run #%d is writing to it)", holder)
		return nil
	}
	defer func() { _ = r.Store.Unlock(context.WithoutCancel(ctx), repoLock(p.Repo), run.ID, st.Key) }()

	refs, err := w.plat.Refs(ctx, p.Repo)
	if err != nil {
		st.Detail = "cannot read the repo, retrying: " + err.Error()
		return nil
	}
	_, base, ok := refs.Head(st.Branch)
	if !ok {
		r.fail(w, st, "the branch "+st.Branch+" was not found")
		return nil
	}
	f, err := com.ReadFile(ctx, p.Repo, st.Branch, st.File)
	if err != nil {
		st.Detail = "cannot read the manifest, retrying: " + err.Error()
		return nil
	}
	for i := range st.Deps {
		st.Deps[i].Version = r.depVersion(w, run, st.Deps[i])
	}
	content, _, err := setRanges(f.Content, st.Deps)
	if err != nil {
		r.fail(w, st, st.File+": "+err.Error())
		return nil
	}
	if content == nil {
		st.Adopted, st.Commit = true, base
		r.done(w, st, st.File+" has these ranges already")
		return nil
	}
	st.Fired = w.now
	if err := r.Store.SaveStep(ctx, run.ID, *st); err != nil {
		return err
	}
	ch := adapter.FileChange{Repo: p.Repo, Branch: st.Branch, Base: base, Path: st.File, Content: content,
		Message: commitMessage(p.Name, st.Deps, run.ID, st.Key)}
	if st.Via == model.ViaPR {
		pr, err := com.OpenPR(ctx, ch, prBranch(run.ID, st), firstLine(ch.Message), prBody(st, run.ID))
		if err != nil {
			r.fail(w, st, "pull request: "+err.Error())
			return nil
		}
		st.PR, st.URL = pr.Number, pr.URL
		r.prState(w, st, pr)
		return nil
	}
	commit, url, err := com.Commit(ctx, ch, f.SHA)
	switch {
	case platform.IsStatus(err, http.StatusConflict):
		st.Detail = "the file changed while writing; trying again" // read again next pass
		return nil
	case err != nil:
		r.fail(w, st, "commit: "+err.Error())
		return nil
	}
	st.Commit, st.URL = commit, url
	r.done(w, st, "committed to "+st.Branch)
	r.wake(p.Name)
	return nil
}

// watchPR follows a paused step's pull request: merged is done, closed
// without a merge failed. It waits as long as it takes (no stall timeout).
func (r *Runner) watchPR(ctx context.Context, w *world, run *model.Run, p catalog.Package, st *model.Step) {
	key := statusKey(run.ID, st.Key)
	if w.now.Sub(r.lastStatus[key]) < r.StatusEvery {
		return
	}
	r.lastStatus[key] = w.now
	com, ok := w.plat.Committer(p)
	if !ok {
		r.fail(w, st, "writing to the repo needs the GitHub App")
		return
	}
	pr, err := com.PullRequest(ctx, p.Repo, st.PR)
	if err != nil {
		st.Detail = "cannot read the pull request, retrying: " + err.Error()
		return
	}
	r.prState(w, st, pr)
	if st.State == model.StepDone {
		r.wake(p.Name)
	}
}

func (r *Runner) prState(w *world, st *model.Step, pr adapter.PullRequest) {
	switch pr.State {
	case adapter.PRMerged:
		st.Commit = pr.Merge
		r.done(w, st, fmt.Sprintf("pull request #%d merged", pr.Number))
	case adapter.PRClosed:
		r.fail(w, st, fmt.Sprintf("pull request #%d was closed without a merge", pr.Number))
	default:
		st.State, st.Detail = model.StepPaused, fmt.Sprintf("waiting for pull request #%d to be merged", pr.Number)
		if st.Progress.IsZero() {
			st.Progress = w.now
		}
	}
}

// depVersion is the version a dependency reaches: the one its release step
// in this run released, or its latest published version.
func (r *Runner) depVersion(w *world, run *model.Run, d model.DepChange) string {
	for _, s := range run.Steps {
		if s.Type == model.StepRelease && s.Package == d.Package {
			return s.Version
		}
	}
	if p, ok := w.cat.Package(d.Package); ok {
		if v := latestPublished(p, w.states[d.Package]); v != "" {
			return v
		}
	}
	return d.Version
}

// prBranch is the pull request's branch: one per step and attempt, so a
// resumed step opens a new pull request after a closed one.
func prBranch(run int64, st *model.Step) string {
	b := fmt.Sprintf("beacon/run-%d-%s", run, st.Key)
	if st.Attempt > 0 {
		b += fmt.Sprintf("-%d", st.Attempt+1)
	}
	return b
}

func commitMessage(pkg string, deps []model.DepChange, run int64, key string) string {
	var parts []string
	for _, d := range deps {
		if d.To != "" {
			parts = append(parts, d.Name+" "+d.To)
		}
	}
	return fmt.Sprintf("chore(%s): depend on %s\n\nBeacon run #%d, step %s.", pkg, strings.Join(parts, ", "), run, key)
}

func prBody(st *model.Step, run int64) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Sets the dependency ranges in `%s`:\n\n", st.File)
	for _, d := range st.Deps {
		if d.To != "" && d.From != d.To {
			fmt.Fprintf(&b, "- `%s`: `%s` → `%s`\n", d.Name, d.From, d.To)
		}
	}
	fmt.Fprintf(&b, "\nOpened by Beacon run #%d (step `%s`). The plan waits until this is merged; closing it without a merge fails the step.\n", run, st.Key)
	return b.String()
}

func firstLine(s string) string {
	line, _, _ := strings.Cut(s, "\n")
	return line
}
