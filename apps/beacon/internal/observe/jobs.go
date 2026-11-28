// Package observe is the observation loop: it turns the catalog into poll
// jobs (one per repo, CI workflow, artifact and deployment target, plus the
// unreleased changes per repo), runs them on an adaptive schedule, writes
// what they observe to the store, and announces the resulting changes.
// Webhooks wake jobs early; CDEvents push observations into the same path.
package observe

import (
	"context"
	"encoding/json"
	"net/url"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

// Job is one poll: an adapter call for one or more packages.
type Job struct {
	Key      string   // unique, stable across catalog reloads
	Layer    string   // source, changes, ci, artifact, runtime
	Host     string   // the platform host, for its rate-limit budget
	Repo     string   // the packages' repo URL, for webhook hints
	Workflow string   // the CI workflow file (ci jobs), for webhook hints
	Packages []string // the packages it observes
	Spec     string   // its configuration; a changed Spec is polled again at once
	Poll     func(ctx context.Context) (Batch, error)
}

// Batch is what one poll observed.
type Batch struct {
	Obs        []model.Obs
	Unreleased []model.Unreleased
}

// Adapters are the implementations jobs call. Changes is optional.
type Adapters struct {
	Source    adapter.Source
	CI        adapter.CI
	NPM       adapter.Artifact
	OCI       adapter.Artifact
	HTTPCheck adapter.Runtime
	Coolify   adapter.Runtime
	Changes   adapter.ChangeLister
}

// Jobs builds the poll jobs of a catalog.
func Jobs(c catalog.Catalog, a Adapters) []Job {
	var jobs []Job
	jobs = append(jobs, repoJobs(c, a)...)
	for _, p := range c.Packages {
		p := p
		m, err := catalog.NewTagMatcher(p.Tag, p.Name)
		if err != nil {
			continue // validated on apply
		}
		if p.CI != nil && p.CI.GitHubActions != nil {
			jobs = append(jobs, Job{
				Key: "ci/" + p.Name, Layer: "ci", Host: hostOf(apiURL(c)), Repo: p.Repo.URL, Workflow: p.CI.GitHubActions.Workflow,
				Packages: []string{p.Name}, Spec: spec(p.CI, p.Repo, p.Tag),
				Poll: obsPoll(func(ctx context.Context) ([]model.Obs, error) { return a.CI.Runs(ctx, p, m) }),
			})
		}
		if art := p.Artifact; art != nil {
			impl, host := a.NPM, ""
			if art.NPM != nil {
				host = hostOf(art.NPM.Registry)
			} else {
				impl, host = a.OCI, art.OCI.Registry
			}
			jobs = append(jobs, Job{
				Key: "artifact/" + p.Name, Layer: "artifact", Host: host, Repo: p.Repo.URL, Packages: []string{p.Name}, Spec: spec(art),
				Poll: obsPoll(func(ctx context.Context) ([]model.Obs, error) { return impl.Versions(ctx, p) }),
			})
		}
		for _, d := range p.Deploy {
			if j, ok := runtimeJob(c, a, p, d); ok {
				jobs = append(jobs, j)
			}
		}
	}
	return jobs
}

func runtimeJob(c catalog.Catalog, a Adapters, p catalog.Package, d catalog.Deploy) (Job, bool) {
	if d.CDEvents {
		return Job{}, false // pushed to /cdevents, nothing to poll
	}
	impl, host := a.HTTPCheck, ""
	if d.HTTPCheck != nil {
		host = hostOf(d.HTTPCheck.URL)
	} else {
		impl = a.Coolify
		if t, ok := c.Target(d.Target); ok && t.Coolify != nil {
			host = hostOf(t.Coolify.URL)
		}
	}
	return Job{
		Key: "runtime/" + p.Name + "/" + d.Target, Layer: "runtime", Host: host, Repo: p.Repo.URL,
		Packages: []string{p.Name}, Spec: spec(d),
		Poll: obsPoll(func(ctx context.Context) ([]model.Obs, error) {
			o, err := impl.Running(ctx, p.Name, d)
			if err != nil {
				return nil, err
			}
			return []model.Obs{o}, nil
		}),
	}, true
}

func obsPoll(f func(ctx context.Context) ([]model.Obs, error)) func(ctx context.Context) (Batch, error) {
	return func(ctx context.Context) (Batch, error) {
		obs, err := f(ctx)
		return Batch{Obs: obs}, err
	}
}

// repoGroup is the packages of one repo.
type repoGroup struct {
	repo     catalog.Repo
	pkgs     []catalog.Package
	matchers []catalog.TagMatcher
	names    []string
	specs    []string
}

func groupByRepo(c catalog.Catalog) []*repoGroup {
	var order []*repoGroup
	groups := map[string]*repoGroup{}
	for _, p := range c.Packages {
		m, err := catalog.NewTagMatcher(p.Tag, p.Name)
		if err != nil {
			continue
		}
		g := groups[p.Repo.URL]
		if g == nil {
			g = &repoGroup{repo: p.Repo}
			groups[p.Repo.URL] = g
			order = append(order, g)
		}
		g.pkgs, g.matchers = append(g.pkgs, p), append(g.matchers, m)
		g.names, g.specs = append(g.names, p.Name), append(g.specs, p.Name+" "+p.Tag+" "+p.Branch+" "+p.Path)
	}
	return order
}

// repoJobs: one tag listing per repo, mapped to every package in it; and,
// with a change lister, one unreleased-changes job per GitHub repo.
func repoJobs(c catalog.Catalog, a Adapters) []Job {
	var jobs []Job
	for _, g := range groupByRepo(c) {
		g := g
		jobs = append(jobs, Job{
			Key: "source/" + g.repo.URL, Layer: "source", Host: hostOf(g.repo.URL), Repo: g.repo.URL,
			Packages: g.names, Spec: spec(g.repo, g.specs),
			Poll: func(ctx context.Context) (Batch, error) {
				refs, err := a.Source.Refs(ctx, g.repo)
				if err != nil {
					return Batch{}, err
				}
				return Batch{Obs: TagObservations(refs.Tags, g.names, g.matchers)}, nil
			},
		})
		if a.Changes != nil && g.repo.GitHub != "" {
			jobs = append(jobs, Job{
				Key: "changes/" + g.repo.URL, Layer: "changes", Host: hostOf(apiURL(c)), Repo: g.repo.URL,
				Packages: g.names, Spec: spec(g.repo, g.specs),
				Poll: func(ctx context.Context) (Batch, error) { return unreleased(ctx, a, g) },
			})
		}
	}
	return jobs
}

// TagObservations maps tags to tagged observations of the packages they name.
func TagObservations(tags []adapter.Tag, names []string, matchers []catalog.TagMatcher) []model.Obs {
	var out []model.Obs
	for _, t := range tags {
		for i, m := range matchers {
			if v, ok := m.Version(t.Name); ok {
				out = append(out, model.Obs{Package: names[i], Version: v, Stage: model.Tagged, State: model.OK, Detail: shortSHA(t.Commit)})
			}
		}
	}
	return out
}

func shortSHA(s string) string {
	if len(s) > 7 {
		return s[:7]
	}
	return s
}

func apiURL(c catalog.Catalog) string {
	if c.GitHub != nil {
		return c.GitHub.APIURL
	}
	return "https://api.github.com"
}

func hostOf(u string) string {
	if p, err := url.Parse(u); err == nil {
		return p.Host
	}
	return ""
}

func spec(v ...any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
