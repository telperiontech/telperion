// Package githubrelease starts a release by creating a GitHub release with a
// new tag at the branch head (the `gh release create --target <sha>`
// equivalent), or only the tag (Git refs API). The tag push starts the
// repo's tag-triggered publish workflow: tags created with an App
// installation token do trigger workflows.
package githubrelease

import (
	"context"
	"errors"
	"fmt"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/githubapi"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
)

// Trigger implements adapter.Trigger.
type Trigger struct {
	API githubapi.API
}

var _ adapter.Trigger = Trigger{}

// Describe says what Fire does.
func (t Trigger) Describe(req adapter.ReleaseRequest) string {
	cfg := settings(req)
	at := fmt.Sprintf("at %s on %s", short(req.Commit), req.Branch)
	switch {
	case cfg.TagOnly:
		return fmt.Sprintf("create the tag %s %s", req.Tag, at)
	case cfg.Notes == catalog.NotesGenerate:
		return fmt.Sprintf("create the GitHub release %s %s, with generated release notes", req.Tag, at)
	}
	return fmt.Sprintf("create the GitHub release %s %s", req.Tag, at)
}

// Fire creates the release (or tag). A tag that exists already is adopted.
func (t Trigger) Fire(ctx context.Context, req adapter.ReleaseRequest) (adapter.Fired, error) {
	repo := req.Package.Repo.GitHub
	if repo == "" || req.Commit == "" {
		return adapter.Fired{}, errors.New("a GitHub release needs a GitHub repo and a commit")
	}
	exists, err := t.API.RefExists(ctx, repo, "tags/"+req.Tag)
	if err != nil {
		return adapter.Fired{}, err
	}
	if exists {
		return adapter.Fired{Detail: "adopted: the tag " + req.Tag + " exists"}, nil
	}
	cfg := settings(req)
	if cfg.TagOnly {
		err := t.API.Do(ctx, githubapi.Call{
			Method: "POST", Repo: repo, Path: "/git/refs", Write: true,
			Body: map[string]string{"ref": "refs/tags/" + req.Tag, "sha": req.Commit},
		}, nil)
		return adapter.Fired{Detail: "created the tag " + req.Tag}, err
	}
	var rel struct {
		HTMLURL string `json:"html_url"`
	}
	err = t.API.Do(ctx, githubapi.Call{
		Method: "POST", Repo: repo, Path: "/releases", Write: true,
		Body: map[string]any{
			"tag_name": req.Tag, "target_commitish": req.Commit, "name": req.Tag,
			"generate_release_notes": cfg.Notes == catalog.NotesGenerate,
		},
	}, &rel)
	return adapter.Fired{URL: rel.HTMLURL, Detail: "created the release " + req.Tag}, err
}

func settings(req adapter.ReleaseRequest) catalog.GitHubRelease {
	if r := req.Package.Release; r != nil && r.GitHubRelease != nil {
		return *r.GitHubRelease
	}
	return catalog.GitHubRelease{Notes: catalog.NotesGenerate}
}

func short(sha string) string {
	if len(sha) > 7 {
		return sha[:7]
	}
	return sha
}
