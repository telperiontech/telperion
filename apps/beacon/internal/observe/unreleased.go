package observe

import (
	"context"
	"errors"
	"fmt"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
	"github.com/telperiontech/telperion/apps/beacon/internal/semver"
)

// unreleased counts, for every package of a repo, the commits on its branch
// since its latest release tag. Packages whose compare is unchanged
// (not modified) are left out; when all are, the poll is not modified.
func unreleased(ctx context.Context, a Adapters, g *repoGroup) (Batch, error) {
	refs, err := a.Source.Refs(ctx, g.repo)
	if err != nil {
		return Batch{}, err
	}
	var b Batch
	unchanged := 0
	for i, p := range g.pkgs {
		branch, _, ok := refs.Head(p.Branch)
		if !ok {
			return Batch{}, fmt.Errorf("%s: branch %q not found", p.Name, branch)
		}
		u, err := a.Changes.Unreleased(ctx, p, LatestTag(refs, g.matchers[i]), branch)
		switch {
		case errors.Is(err, platform.ErrNotModified):
			unchanged++
		case err != nil:
			return Batch{}, fmt.Errorf("%s: %w", p.Name, err)
		default:
			b.Unreleased = append(b.Unreleased, u)
		}
	}
	if unchanged == len(g.pkgs) {
		return Batch{}, platform.ErrNotModified
	}
	return b, nil
}

// LatestTag is the tag of the package's newest release version ("" if none).
func LatestTag(refs adapter.Refs, m catalog.TagMatcher) string {
	tags := map[string]string{}
	var versions []string
	for _, t := range refs.Tags {
		if v, ok := m.Version(t.Name); ok {
			tags[v] = t.Name
			versions = append(versions, v)
		}
	}
	return tags[semver.Latest(versions)]
}
