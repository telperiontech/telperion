package observe

import (
	"fmt"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/coolify"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/githubactions"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/gitsource"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/httpcheck"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/npm"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/oci"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
	"github.com/telperiontech/telperion/apps/beacon/internal/secret"
)

// Build makes the jobs of a catalog with the real adapters. Without a GitHub
// App in the catalog, GitHub is read anonymously (60 requests an hour).
func Build(c catalog.Catalog, client *platform.Client) ([]Job, error) {
	var tokens adapter.GitHubTokens = adapter.Anonymous{}
	if c.GitHub != nil {
		app, err := secret.NewGitHubApp(*c.GitHub, client, secret.ReadPermissions)
		if err != nil {
			return nil, fmt.Errorf("github: %w", err)
		}
		tokens = app
	}
	return Jobs(c, Adapters{
		Source:    gitsource.Source{Client: client, GitHub: tokens},
		CI:        githubactions.CI{Client: client, APIURL: apiURL(c), Tokens: tokens},
		NPM:       npm.Artifact{Client: client},
		OCI:       &oci.Artifact{Client: client},
		HTTPCheck: httpcheck.Runtime{Client: client},
		Coolify:   coolify.Runtime{Client: client, Targets: c.Target},
	}), nil
}
