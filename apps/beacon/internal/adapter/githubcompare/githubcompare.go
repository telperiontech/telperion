// Package githubcompare counts a package's unreleased changes: the commits on
// its branch since its latest tag (compare API), and, when the package has a
// path, only those that touch it (commits API with path, intersected).
package githubcompare

import (
	"context"
	"errors"
	"net/url"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/githubapi"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
)

// Changes implements adapter.ChangeLister.
type Changes struct {
	API    githubapi.API
	WebURL string // e.g. https://github.com, for the compare link
}

var _ adapter.ChangeLister = Changes{}

type commit struct {
	SHA string `json:"sha"`
}

// Unreleased compares tag...branch. The compare answer depends only on the two
// commits, so it is a conditional request: when it is unchanged, so is the
// count (platform.ErrNotModified). The compare lists up to 250 commits; a
// package further ahead than that is counted within those.
func (c Changes) Unreleased(ctx context.Context, pkg catalog.Package, tag, branch string) (model.Unreleased, error) {
	repo := pkg.Repo.GitHub
	if repo == "" {
		return model.Unreleased{}, errors.New("unreleased changes need a GitHub repo")
	}
	out := model.Unreleased{Package: pkg.Name, Tag: tag, Branch: branch}
	if tag == "" {
		return out, c.countPath(ctx, pkg, branch, nil, &out)
	}
	base := "/compare/" + url.PathEscape(tag) + "..." + url.PathEscape(branch)
	var cmp struct {
		AheadBy int      `json:"ahead_by"`
		Commits []commit `json:"commits"`
	}
	if err := c.API.Do(ctx, githubapi.Call{Repo: repo, Path: base, ETagKey: pkg.Name + " " + base}, &cmp); err != nil {
		return out, err
	}
	out.URL = c.WebURL + "/" + repo + base
	if pkg.Path == "" {
		out.Commits = cmp.AheadBy
		return out, nil
	}
	ahead := map[string]bool{}
	for _, cm := range cmp.Commits {
		ahead[cm.SHA] = true
	}
	if err := c.countPath(ctx, pkg, branch, ahead, &out); err != nil {
		c.API.Client.ForgetETag(pkg.Name + " " + base) // read the compare again next time
		return out, err
	}
	return out, nil
}

// countPath counts the newest 100 commits on branch that touch the package's
// path and, with ahead set, are among those commits.
func (c Changes) countPath(ctx context.Context, pkg catalog.Package, branch string, ahead map[string]bool, out *model.Unreleased) error {
	q := url.Values{"sha": {branch}, "per_page": {"100"}}
	if pkg.Path != "" {
		q.Set("path", pkg.Path)
	}
	var commits []commit
	if err := c.API.Do(ctx, githubapi.Call{Repo: pkg.Repo.GitHub, Path: "/commits?" + q.Encode()}, &commits); err != nil {
		if platform.IsStatus(err, 409) { // empty repository
			return nil
		}
		return err
	}
	for _, cm := range commits {
		if ahead == nil || ahead[cm.SHA] {
			out.Commits++
		}
	}
	return nil
}
