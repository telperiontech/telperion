// Package githubdispatch starts a release by dispatching a workflow
// (workflow_dispatch) whose job creates the tag. The dispatch returns no run;
// Beacon follows the release through the tag and the chain it starts.
package githubdispatch

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"net/url"
	"slices"
	"strings"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/githubapi"
)

// Trigger implements adapter.Trigger.
type Trigger struct {
	API githubapi.API
}

var _ adapter.Trigger = Trigger{}

// Describe says what Fire does.
func (t Trigger) Describe(req adapter.ReleaseRequest) string {
	d := req.Package.Release.GitHubDispatch
	in := Inputs(req)
	parts := make([]string, 0, len(in))
	for _, k := range slices.Sorted(maps.Keys(in)) {
		parts = append(parts, k+"="+in[k])
	}
	return fmt.Sprintf("dispatch %s on %s with %s", d.Workflow, req.Branch, strings.Join(parts, ", "))
}

// Fire dispatches the workflow. A tag that exists already is adopted.
func (t Trigger) Fire(ctx context.Context, req adapter.ReleaseRequest) (adapter.Fired, error) {
	repo := req.Package.Repo.GitHub
	if repo == "" || req.Package.Release == nil || req.Package.Release.GitHubDispatch == nil {
		return adapter.Fired{}, errors.New("not a github-dispatch package")
	}
	exists, err := t.API.RefExists(ctx, repo, "tags/"+req.Tag)
	if err != nil {
		return adapter.Fired{}, err
	}
	if exists {
		return adapter.Fired{Detail: "adopted: the tag " + req.Tag + " exists"}, nil
	}
	wf := req.Package.Release.GitHubDispatch.Workflow
	err = t.API.Do(ctx, githubapi.Call{
		Method: "POST", Repo: repo, Path: "/actions/workflows/" + url.PathEscape(wf) + "/dispatches", Write: true,
		Body: map[string]any{"ref": req.Branch, "inputs": Inputs(req)},
	}, nil)
	return adapter.Fired{Detail: "dispatched " + wf + " on " + req.Branch}, err
}

// Inputs are the configured inputs with {package}, {version}, {tag} and
// {bump} filled in.
func Inputs(req adapter.ReleaseRequest) map[string]string {
	r := strings.NewReplacer("{package}", req.Package.Name, "{version}", req.Version, "{tag}", req.Tag, "{bump}", req.Bump)
	out := map[string]string{}
	for k, v := range req.Package.Release.GitHubDispatch.Inputs {
		out[k] = r.Replace(v)
	}
	return out
}
