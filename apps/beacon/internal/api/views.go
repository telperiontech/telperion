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
	Actions Actions             `json:"actions"`
	// Unreleased is the commits since the latest tag (GitHub repos with the
	// App); nil when not known.
	Unreleased *model.Unreleased `json:"unreleased,omitempty"`
	ActiveRun  *RunRef           `json:"activeRun,omitempty"` // a plan run with an active step on it
}

// Actions are the one-click actions the package's adapters support.
type Actions struct {
	Release bool     `json:"release"` // a release trigger is configured
	Deploy  []string `json:"deploy"`  // targets Beacon can deploy to
	Rerun   bool     `json:"rerun"`   // failed builds can be re-run
}

// RunRef points to a plan run.
type RunRef struct {
	ID    int64  `json:"id"`
	Title string `json:"title"`
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
	Runs     []model.Run          `json:"runs"` // the newest plan runs with a step on it
}

// maxVersions bounds the timeline of a package.
const maxVersions = 200

// viewContext is what every package view reads besides its own observations.
type viewContext struct {
	cat        catalog.Catalog
	unreleased map[string]model.Unreleased
	active     []model.Run
	now        time.Time
}

func (v Views) load(ctx context.Context) (viewContext, error) {
	vc := viewContext{now: v.Now()}
	var err error
	if vc.cat, err = v.Store.LoadCatalog(ctx); err != nil {
		return vc, err
	}
	if vc.unreleased, err = v.Store.Unreleased(ctx); err != nil {
		return vc, err
	}
	vc.active, err = v.Store.ActiveRuns(ctx)
	return vc, err
}

// Overview builds the main screen.
func (v Views) Overview(ctx context.Context) (Overview, error) {
	vc, err := v.load(ctx)
	if err != nil {
		return Overview{}, err
	}
	states, err := v.Store.States(ctx, "")
	if err != nil {
		return Overview{}, err
	}
	out := Overview{Packages: make([]PackageView, 0, len(vc.cat.Packages)), At: vc.now}
	for _, p := range vc.cat.Packages {
		pv, _ := vc.view(p, states[p.Name])
		out.Packages = append(out.Packages, pv)
	}
	slices.SortFunc(out.Packages, byUrgency)
	return out, nil
}

// Package builds one package's timeline.
func (v Views) Package(ctx context.Context, name string) (PackageDetail, error) {
	vc, err := v.load(ctx)
	if err != nil {
		return PackageDetail{}, err
	}
	p, ok := vc.cat.Package(name)
	if !ok {
		return PackageDetail{}, ErrNotFound
	}
	states, err := v.Store.States(ctx, name)
	if err != nil {
		return PackageDetail{}, err
	}
	pv, versions := vc.view(p, states[name])
	events, err := v.Store.Events(ctx, name, 0, 50)
	if err != nil {
		return PackageDetail{}, err
	}
	runs, err := v.Store.PackageRuns(ctx, name, 10)
	if err != nil {
		return PackageDetail{}, err
	}
	if len(versions) > maxVersions {
		versions = versions[:maxVersions]
	}
	return PackageDetail{PackageView: pv, Versions: versions, Events: events, Runs: runs}, nil
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

func (vc viewContext) view(p catalog.Package, ps *store.PackageState) (PackageView, []model.VersionCells) {
	if ps == nil {
		ps = &store.PackageState{}
	}
	chain, targets := p.Chain(), p.Targets()
	versions := model.Cells(chain, targets, ps.Versions, ps.Rows)
	pv := PackageView{
		Name: p.Name, Project: p.Project, Chain: chain, Targets: targets,
		Gaps: model.Gaps(chain, versions, vc.now), Links: links(p), Actions: actions(vc.cat, p),
	}
	if u, ok := vc.unreleased[p.Name]; ok {
		pv.Unreleased = &u
	}
	for _, r := range vc.active {
		if slices.ContainsFunc(r.Steps, func(s model.Step) bool { return s.Package == p.Name && !s.State.Terminal() }) {
			pv.ActiveRun = &RunRef{ID: r.ID, Title: r.Title}
		}
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

// actions lists what the package's adapters can do (the UI shows only these).
func actions(c catalog.Catalog, p catalog.Package) Actions {
	a := Actions{
		Release: p.Release != nil,
		Deploy:  []string{},
		Rerun:   p.CI != nil && p.CI.GitHubActions != nil && c.GitHub != nil,
	}
	for _, d := range p.Deploy {
		if d.Coolify != nil {
			a.Deploy = append(a.Deploy, d.Target)
		}
	}
	return a
}
