package api

import (
	"cmp"
	"context"
	"errors"
	"slices"
	"strings"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/metrics"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/store"
)

// ErrNotFound: no package of that name.
var ErrNotFound = errors.New("not found")

// Views computes what the UI shows from the catalog and the observations.
// The UI and the API use the same code.
type Views struct {
	Store *store.Store
	Now   func() time.Time
}

// PackageView is one row of the overview.
type PackageView struct {
	Name    string              `json:"name"`
	Project string              `json:"project"`
	Chain   []model.Stage       `json:"chain"`
	Targets []string            `json:"targets"`
	Latest  *model.VersionCells `json:"latest"` // newest version, if any
	Gaps    []model.Gap         `json:"gaps"`
	Links   Links               `json:"links"`
}

// Links point to the package on its platforms.
type Links struct {
	Repo     string `json:"repo,omitempty"`
	CI       string `json:"ci,omitempty"`
	Registry string `json:"registry,omitempty"`
}

// Overview is the main screen: packages with stuck gaps first (oldest first),
// then other gaps, then the rest by name.
type Overview struct {
	Packages []PackageView `json:"packages"`
	At       time.Time     `json:"at"`
}

// PackageDetail is a package's version timeline and recent events.
type PackageDetail struct {
	PackageView
	Versions []model.VersionCells `json:"versions"`
	Events   []store.Event        `json:"events"`
}

// maxVersions bounds the timeline of a package.
const maxVersions = 200

// Overview builds the main screen.
func (v Views) Overview(ctx context.Context) (Overview, error) {
	c, err := v.Store.LoadCatalog(ctx)
	if err != nil {
		return Overview{}, err
	}
	states, err := v.Store.States(ctx, "")
	if err != nil {
		return Overview{}, err
	}
	now := v.Now()
	out := Overview{Packages: make([]PackageView, 0, len(c.Packages)), At: now}
	for _, p := range c.Packages {
		pv, _ := view(p, states[p.Name], now)
		out.Packages = append(out.Packages, pv)
	}
	slices.SortFunc(out.Packages, byUrgency)
	return out, nil
}

// Package builds one package's timeline.
func (v Views) Package(ctx context.Context, name string) (PackageDetail, error) {
	c, err := v.Store.LoadCatalog(ctx)
	if err != nil {
		return PackageDetail{}, err
	}
	p, ok := c.Package(name)
	if !ok {
		return PackageDetail{}, ErrNotFound
	}
	states, err := v.Store.States(ctx, name)
	if err != nil {
		return PackageDetail{}, err
	}
	pv, versions := view(p, states[name], v.Now())
	events, err := v.Store.Events(ctx, name, 0, 50)
	if err != nil {
		return PackageDetail{}, err
	}
	if len(versions) > maxVersions {
		versions = versions[:maxVersions]
	}
	return PackageDetail{PackageView: pv, Versions: versions, Events: events}, nil
}

// Gauges counts packages and gaps for /metrics.
func (v Views) Gauges(ctx context.Context) (metrics.Gauges, error) {
	o, err := v.Overview(ctx)
	if err != nil {
		return metrics.Gauges{}, err
	}
	g := metrics.Gauges{Packages: len(o.Packages), Gaps: map[string]int{}, Stuck: map[string]int{}}
	for _, p := range o.Packages {
		for _, gap := range p.Gaps {
			g.Gaps[string(gap.To)]++
			if gap.Stuck {
				g.Stuck[string(gap.To)]++
			}
		}
	}
	return g, nil
}

func view(p catalog.Package, ps *store.PackageState, now time.Time) (PackageView, []model.VersionCells) {
	if ps == nil {
		ps = &store.PackageState{}
	}
	chain, targets := p.Chain(), p.Targets()
	versions := model.Cells(chain, targets, ps.Versions, ps.Rows)
	pv := PackageView{
		Name: p.Name, Project: p.Project, Chain: chain, Targets: targets,
		Gaps: model.Gaps(chain, versions, now), Links: links(p),
	}
	if pv.Gaps == nil {
		pv.Gaps = []model.Gap{}
	}
	if pv.Targets == nil {
		pv.Targets = []string{}
	}
	if len(versions) > 0 {
		pv.Latest = &versions[0]
	}
	return pv, versions
}

func byUrgency(a, b PackageView) int {
	rank := func(p PackageView) int {
		switch {
		case slices.ContainsFunc(p.Gaps, func(g model.Gap) bool { return g.Stuck }):
			return 0
		case len(p.Gaps) > 0:
			return 1
		}
		return 2
	}
	oldest := func(p PackageView) time.Time {
		if len(p.Gaps) == 0 {
			return time.Time{}
		}
		return slices.MinFunc(p.Gaps, func(x, y model.Gap) int { return x.Since.Compare(y.Since) }).Since
	}
	return cmp.Or(cmp.Compare(rank(a), rank(b)), oldest(a).Compare(oldest(b)), cmp.Compare(a.Name, b.Name))
}

func links(p catalog.Package) Links {
	var l Links
	if p.Repo.GitHub != "" {
		l.Repo = strings.TrimSuffix(p.Repo.URL, ".git")
		if p.CI != nil && p.CI.GitHubActions != nil {
			l.CI = l.Repo + "/actions/workflows/" + p.CI.GitHubActions.Workflow
		}
	}
	if a := p.Artifact; a != nil {
		switch {
		case a.NPM != nil && a.NPM.Registry == "https://registry.npmjs.org":
			l.Registry = "https://www.npmjs.com/package/" + a.NPM.Name
		case a.OCI != nil && a.OCI.Registry == "ghcr.io":
			l.Registry = "https://ghcr.io/" + a.OCI.Name
		case a.OCI != nil && a.OCI.Registry == "registry-1.docker.io":
			l.Registry = "https://hub.docker.com/r/" + strings.TrimPrefix(a.OCI.Name, "library/")
		}
	}
	return l
}
