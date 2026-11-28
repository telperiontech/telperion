// Package adapter defines the read side of Beacon's adapter layers. An adapter
// returns observations keyed by package + version; it never writes to the
// store and knows nothing about plans. Implementations live in sub-packages
// and use plain net/http (internal/platform), no vendor SDKs.
//
// Write capabilities (triggers, deployers, re-runs) are separate interfaces
// that arrive with Phase 2.
package adapter

import (
	"context"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

// Tag is a tag and the commit it points at (peeled for annotated tags).
type Tag struct {
	Name   string
	Commit string
}

// Source lists which versions exist: a repo's tags.
type Source interface {
	Tags(ctx context.Context, repo catalog.Repo) ([]Tag, error)
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

// GitHubTokens returns a token for a GitHub repo "owner/name"; "" means
// anonymous (no App configured).
type GitHubTokens interface {
	Token(ctx context.Context, repo string) (string, error)
}

// Anonymous is GitHubTokens without an App.
type Anonymous struct{}

// Token returns "".
func (Anonymous) Token(context.Context, string) (string, error) { return "", nil }
