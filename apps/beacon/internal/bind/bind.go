// Package bind builds the adapters of a catalog, read and write, once per
// catalog: the observation loop and the plan runner share them, and with them
// one GitHub App and its token cache.
package bind

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/coolify"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/githubactions"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/githubapi"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/githubcompare"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/githubcontents"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/githubdispatch"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/githubrelease"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/gitsource"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/httpcheck"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/npm"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/oci"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/webhook"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/observe"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
	"github.com/telperiontech/telperion/apps/beacon/internal/secret"
)

// Set is every adapter of one catalog.
type Set struct {
	Catalog catalog.Catalog
	Source  adapter.Source
	CI      githubactions.CI
	Coolify coolify.Runtime
	// Changes counts unreleased commits; nil without a GitHub App (anonymous
	// access allows 60 requests an hour, too few for it).
	Changes adapter.ChangeLister

	npm       adapter.Artifact
	oci       adapter.Artifact
	httpCheck adapter.Runtime
	release   githubrelease.Trigger
	dispatch  githubdispatch.Trigger
	hook      webhook.Trigger
	files     githubcontents.Committer
}

// New builds the adapters. Without a GitHub App in the catalog, GitHub is
// read anonymously and cannot be written to.
func New(c catalog.Catalog, client *platform.Client) (*Set, error) {
	var tokens adapter.GitHubTokens = adapter.Anonymous{}
	apiURL, webURL := "https://api.github.com", "https://github.com"
	if c.GitHub != nil {
		app, err := secret.NewGitHubApp(*c.GitHub, client)
		if err != nil {
			return nil, fmt.Errorf("github: %w", err)
		}
		tokens, apiURL, webURL = app, c.GitHub.APIURL, c.GitHub.WebURL
	}
	api := githubapi.API{Client: client, URL: apiURL, Tokens: tokens}
	s := &Set{
		Catalog: c,
		Source:  gitsource.Source{Client: client, GitHub: tokens},
		CI:      githubactions.CI{API: api},
		Coolify: coolify.Runtime{Client: client, Targets: c.Target},

		npm:       npm.Artifact{Client: client},
		oci:       &oci.Artifact{Client: client},
		httpCheck: httpcheck.Runtime{Client: client},
		release:   githubrelease.Trigger{API: api},
		dispatch:  githubdispatch.Trigger{API: api},
		hook:      webhook.Trigger{Client: client},
		files:     githubcontents.Committer{API: api},
	}
	if c.GitHub != nil {
		s.Changes = githubcompare.Changes{API: api, WebURL: webURL}
	}
	return s, nil
}

// Observe is what the observation loop polls with.
func (s *Set) Observe() observe.Adapters {
	return observe.Adapters{
		Source: s.Source, CI: s.CI, NPM: s.npm, OCI: s.oci, HTTPCheck: s.httpCheck, Coolify: s.Coolify, Changes: s.Changes,
	}
}

// Trigger is the package's release trigger.
func (s *Set) Trigger(p catalog.Package) (adapter.Trigger, bool) {
	switch {
	case p.Release == nil:
		return nil, false
	case p.Release.GitHubRelease != nil:
		return s.release, true
	case p.Release.GitHubDispatch != nil:
		return s.dispatch, true
	case p.Release.Webhook != nil:
		return s.hook, true
	}
	return nil, false
}

// Rerunner re-runs the package's failed CI runs, if its CI can.
func (s *Set) Rerunner(p catalog.Package) (adapter.Rerunner, bool) {
	if p.CI == nil || p.CI.GitHubActions == nil || s.Catalog.GitHub == nil {
		return nil, false
	}
	return s.CI, true
}

// Committer writes files of the package's repo (update-deps): GitHub repos,
// with the GitHub App.
func (s *Set) Committer(p catalog.Package) (adapter.Committer, bool) {
	if p.Repo.GitHub == "" || s.Catalog.GitHub == nil {
		return nil, false
	}
	return s.files, true
}

// Deployer deploys the package to a target, if the target's runtime can.
func (s *Set) Deployer(p catalog.Package, target string) (adapter.Deployer, catalog.Deploy, bool) {
	d, ok := p.DeployTo(target)
	if !ok || d.Coolify == nil {
		return nil, d, false
	}
	return s.Coolify, d, true
}

// Cache keeps the Set of the current catalog.
type Cache struct {
	Client *platform.Client

	mu  sync.Mutex
	key string
	set *Set
}

// For returns the Set of c, building it when the catalog changed (recipes
// do not count: they bind no adapter).
func (k *Cache) For(c catalog.Catalog) (*Set, error) {
	key := c
	key.Recipes = nil
	b, err := json.Marshal(key)
	if err != nil {
		return nil, err
	}
	k.mu.Lock()
	defer k.mu.Unlock()
	if k.set != nil && k.key == string(b) {
		return k.set, nil
	}
	s, err := New(c, k.Client)
	if err != nil {
		return nil, err
	}
	k.key, k.set = string(b), s
	return s, nil
}

// Refs reads a repo's refs (plan.Platform).
func (s *Set) Refs(ctx context.Context, repo catalog.Repo) (adapter.Refs, error) {
	return s.Source.Refs(ctx, repo)
}
