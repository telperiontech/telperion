// Package githubactions reports the runs of a package's publish workflow that
// tag pushes started, as built observations (one conditional request per
// poll; the tag of a run is its head_branch), and re-runs a failed run's jobs.
package githubactions

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/githubapi"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

// CI implements adapter.CI and adapter.Rerunner.
type CI struct {
	API githubapi.API
}

var (
	_ adapter.CI       = CI{}
	_ adapter.Rerunner = CI{}
)

type run struct {
	ID         int64     `json:"id"`
	HeadBranch string    `json:"head_branch"`
	Status     string    `json:"status"`
	Conclusion string    `json:"conclusion"`
	HTMLURL    string    `json:"html_url"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type runPage struct {
	Runs []run `json:"workflow_runs"`
}

// Runs returns one observation per version: the newest run for its tag.
// Versions older than the last 100 push runs are not reported.
func (c CI) Runs(ctx context.Context, pkg catalog.Package, tags catalog.TagMatcher) ([]model.Obs, error) {
	if pkg.CI == nil || pkg.CI.GitHubActions == nil {
		return nil, nil
	}
	path := runsPath(pkg) + "?event=push&per_page=100"
	var page runPage
	if err := c.API.Do(ctx, githubapi.Call{Repo: pkg.Repo.GitHub, Path: path, ETagKey: pkg.Name + " " + path}, &page); err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	var out []model.Obs
	for _, r := range page.Runs { // newest first
		v, ok := tags.Version(r.HeadBranch)
		if !ok || seen[v] {
			continue
		}
		seen[v] = true
		state, at := State(r.Status, r.Conclusion), r.UpdatedAt
		if state == model.Pending {
			at = r.CreatedAt
		}
		out = append(out, model.Obs{
			Package: pkg.Name, Version: v, Stage: model.Built, State: state, At: at,
			URL: r.HTMLURL, Detail: detail(r),
		})
	}
	return out, nil
}

// Rerun re-runs the failed jobs of the newest run for tag. It reads first: a
// run that is not failed (already re-running, or passed) is left alone.
func (c CI) Rerun(ctx context.Context, pkg catalog.Package, tag string) (adapter.Fired, error) {
	if pkg.CI == nil || pkg.CI.GitHubActions == nil {
		return adapter.Fired{}, errors.New("the package's CI is not GitHub Actions")
	}
	var page runPage
	path := runsPath(pkg) + "?event=push&per_page=1&branch=" + url.QueryEscape(tag)
	if err := c.API.Do(ctx, githubapi.Call{Repo: pkg.Repo.GitHub, Path: path}, &page); err != nil {
		return adapter.Fired{}, err
	}
	if len(page.Runs) == 0 {
		return adapter.Fired{}, fmt.Errorf("no %s run for %s", pkg.CI.GitHubActions.Workflow, tag)
	}
	r := page.Runs[0]
	if State(r.Status, r.Conclusion) != model.Failed {
		return adapter.Fired{URL: r.HTMLURL, Detail: "adopted: the run is " + detail(r)}, nil
	}
	err := c.API.Do(ctx, githubapi.Call{
		Method: "POST", Repo: pkg.Repo.GitHub, Path: fmt.Sprintf("/actions/runs/%d/rerun-failed-jobs", r.ID), Write: true,
	}, nil)
	if err != nil {
		return adapter.Fired{}, err
	}
	return adapter.Fired{URL: r.HTMLURL, Detail: "re-running the failed jobs"}, nil
}

func runsPath(pkg catalog.Package) string {
	return "/actions/workflows/" + url.PathEscape(pkg.CI.GitHubActions.Workflow) + "/runs"
}

// State maps a run's status and conclusion to a stage state.
func State(status, conclusion string) model.State {
	if status != "completed" {
		return model.Pending // queued, in_progress, waiting, requested, pending
	}
	switch conclusion {
	case "success", "neutral", "skipped":
		return model.OK
	}
	return model.Failed // failure, cancelled, timed_out, action_required, startup_failure, stale
}

func detail(r run) string {
	if r.Status != "completed" {
		return r.Status
	}
	return r.Conclusion
}
