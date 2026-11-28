// Package githubactions reports the runs of a package's publish workflow that
// tag pushes started, as built observations. One conditional request per poll;
// the tag of a run is its head_branch.
package githubactions

import (
	"context"
	"net/http"
	"net/url"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
)

// CI implements adapter.CI.
type CI struct {
	Client *platform.Client
	APIURL string // e.g. https://api.github.com
	Tokens adapter.GitHubTokens
}

var _ adapter.CI = CI{}

type run struct {
	ID         int64     `json:"id"`
	HeadBranch string    `json:"head_branch"`
	Status     string    `json:"status"`
	Conclusion string    `json:"conclusion"`
	HTMLURL    string    `json:"html_url"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// Runs returns one observation per version: the newest run for its tag.
// Versions older than the last 100 push runs are not reported.
func (c CI) Runs(ctx context.Context, pkg catalog.Package, tags catalog.TagMatcher) ([]model.Obs, error) {
	if pkg.CI == nil || pkg.CI.GitHubActions == nil {
		return nil, nil
	}
	h := http.Header{}
	h.Set("Accept", "application/vnd.github+json")
	h.Set("X-GitHub-Api-Version", "2022-11-28")
	tok, err := c.Tokens.Token(ctx, pkg.Repo.GitHub)
	if err != nil {
		return nil, err
	}
	if tok != "" {
		h.Set("Authorization", "Bearer "+tok)
	}
	u := c.APIURL + "/repos/" + pkg.Repo.GitHub + "/actions/workflows/" +
		url.PathEscape(pkg.CI.GitHubActions.Workflow) + "/runs?event=push&per_page=100"
	var page struct {
		Runs []run `json:"workflow_runs"`
	}
	if err := c.Client.JSON(ctx, platform.Request{URL: u, Header: h, Conditional: true, ETagKey: pkg.Name + " " + u}, &page); err != nil {
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
