// Package adapter defines Beacon's adapter layers. Read adapters return
// observations keyed by package + version; they never write to the store and
// know nothing about plans. Write capabilities (triggers, re-runs, deploys)
// are separate interfaces; the plan runner checks before every write whether
// its result already exists. Implementations live in sub-packages and use
// plain net/http (internal/platform), no vendor SDKs.
package adapter

import (
	"context"
	"errors"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

// Tag is a tag and the commit it points at (peeled for annotated tags).
type Tag struct {
	Name   string
	Commit string
}

// Refs is what a repo advertises: its tags, its branch heads and the default
// branch.
type Refs struct {
	Tags    []Tag
	Heads   map[string]string // branch name → commit
	Default string            // the branch HEAD points at; "" if not advertised
}

// Head returns a branch's commit; branch "" is the default branch.
func (r Refs) Head(branch string) (name, commit string, ok bool) {
	if branch == "" {
		branch = r.Default
	}
	commit, ok = r.Heads[branch]
	return branch, commit, ok
}

// Tag returns the tag of that name.
func (r Refs) Tag(name string) (Tag, bool) {
	for _, t := range r.Tags {
		if t.Name == name {
			return t, true
		}
	}
	return Tag{}, false
}

// Source lists a repo's refs.
type Source interface {
	Refs(ctx context.Context, repo catalog.Repo) (Refs, error)
}

// CI reports the runs that tags started, as built observations.
type CI interface {
	Runs(ctx context.Context, pkg catalog.Package, tags catalog.TagMatcher) ([]model.Obs, error)
}

// Artifact reports which versions are published.
type Artifact interface {
	Versions(ctx context.Context, pkg catalog.Package) ([]model.Obs, error)
}

// Runtime reports which version runs on one deployment target.
type Runtime interface {
	Running(ctx context.Context, pkg string, d catalog.Deploy) (model.Obs, error)
}

// ChangeLister counts the commits on a branch since a tag (unreleased
// changes), within the package's path.
type ChangeLister interface {
	Unreleased(ctx context.Context, pkg catalog.Package, tag, branch string) (model.Unreleased, error)
}

// ReleaseRequest is one release to start. Beacon computed the version and the
// tag, and read the commit (the branch head) under the repo lock.
type ReleaseRequest struct {
	Package catalog.Package
	Version string
	Tag     string
	Bump    string // major | minor | patch; "" for an exact version
	Branch  string
	Commit  string
	Plan    int64 // the plan run, for the receiver's reference
}

// Fired is what a write started: a link and a short note.
type Fired struct {
	URL    string `json:"url,omitempty"`
	Detail string `json:"detail,omitempty"`
}

// Trigger starts a release. Its result is observed through the chain (the
// tag, the CI run, the artifact), not reported by the trigger.
type Trigger interface {
	// Describe says what Fire would do, for the preview. No I/O.
	Describe(req ReleaseRequest) string
	Fire(ctx context.Context, req ReleaseRequest) (Fired, error)
}

// Rerunner re-runs the failed jobs of the CI run a tag started.
type Rerunner interface {
	Rerun(ctx context.Context, pkg catalog.Package, tag string) (Fired, error)
}

// DeployRef identifies a started deployment.
type DeployRef struct {
	ID  string `json:"id"`
	URL string `json:"url,omitempty"`
}

// Deployer sets the version a target runs, and reports how that went.
type Deployer interface {
	Deploy(ctx context.Context, pkg string, d catalog.Deploy, version string) (DeployRef, error)
	// DeployStatus is pending, ok or failed, with a short detail.
	DeployStatus(ctx context.Context, d catalog.Deploy, ref DeployRef) (model.State, string, error)
}

// GitHubTokens returns tokens for a GitHub repo "owner/name": read-only ones
// for observing, write ones for actions. "" means anonymous (no App).
type GitHubTokens interface {
	Token(ctx context.Context, repo string) (string, error)
	WriteToken(ctx context.Context, repo string) (string, error)
}

// ErrNoApp: a GitHub write without a GitHub App.
var ErrNoApp = errors.New("writing to GitHub needs the GitHub App (github: in the config)")

// Anonymous is GitHubTokens without an App.
type Anonymous struct{}

// Token returns "".
func (Anonymous) Token(context.Context, string) (string, error) { return "", nil }

// WriteToken fails: anonymous access cannot write.
func (Anonymous) WriteToken(context.Context, string) (string, error) { return "", ErrNoApp }
