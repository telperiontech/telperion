// Package observe is the observation loop: it turns the catalog into poll
// jobs (one per repo, CI workflow, artifact and deployment target), runs them
// on an adaptive schedule, writes what they observe to the store, and
// announces the resulting changes.
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
	Layer    string   // source, ci, artifact, runtime
	Host     string   // the platform host, for its rate-limit budget
	Packages []string // the packages it observes
	Spec     string   // its configuration; a changed Spec is polled again at once
	Poll     func(ctx context.Context) ([]model.Obs, error)
}

// Adapters are the implementations jobs call.
type Adapters struct {
	Source    adapter.Source
	CI        adapter.CI
	NPM       adapter.Artifact
	OCI       adapter.Artifact
	HTTPCheck adapter.Runtime
	Coolify   adapter.Runtime
}

// Jobs builds the poll jobs of a catalog.
func Jobs(c catalog.Catalog, a Adapters) []Job {
	var jobs []Job
	jobs = append(jobs, sourceJobs(c, a.Source)...)
	for _, p := range c.Packages {
		p := p
		m, err := catalog.NewTagMatcher(p.Tag, p.Name)
		if err != nil {
			continue // validated on apply
		}
		if p.CI != nil && p.CI.GitHubActions != nil {
			jobs = append(jobs, Job{
				Key: "ci/" + p.Name, Layer: "ci", Host: hostOf(apiURL(c)), Packages: []string{p.Name}, Spec: spec(p.CI, p.Repo, p.Tag),
				Poll: func(ctx context.Context) ([]model.Obs, error) { return a.CI.Runs(ctx, p, m) },
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
				Key: "artifact/" + p.Name, Layer: "artifact", Host: host, Packages: []string{p.Name}, Spec: spec(art),
				Poll: func(ctx context.Context) ([]model.Obs, error) { return impl.Versions(ctx, p) },
			})
		}
		for _, d := range p.Deploy {
			d := d
			impl, host := a.HTTPCheck, ""
			if d.HTTPCheck != nil {
				host = hostOf(d.HTTPCheck.URL)
			} else {
				impl = a.Coolify
				if t, ok := c.Target(d.Target); ok && t.Coolify != nil {
					host = hostOf(t.Coolify.URL)
				}
			}
			jobs = append(jobs, Job{
				Key: "runtime/" + p.Name + "/" + d.Target, Layer: "runtime", Host: host, Packages: []string{p.Name}, Spec: spec(d),
				Poll: func(ctx context.Context) ([]model.Obs, error) {
					o, err := impl.Running(ctx, p.Name, d)
					if err != nil {
						return nil, err
					}
					return []model.Obs{o}, nil
				},
			})
		}
	}
	return jobs
}

// sourceJobs: one tag listing per repo, mapped to every package in it.
func sourceJobs(c catalog.Catalog, src adapter.Source) []Job {
	type group struct {
		repo     catalog.Repo
		matchers []catalog.TagMatcher
		names    []string
		specs    []string
	}
	var order []string
	groups := map[string]*group{}
	for _, p := range c.Packages {
		m, err := catalog.NewTagMatcher(p.Tag, p.Name)
		if err != nil {
			continue
		}
		g := groups[p.Repo.URL]
		if g == nil {
			g = &group{repo: p.Repo}
			groups[p.Repo.URL] = g
			order = append(order, p.Repo.URL)
		}
		g.matchers, g.names, g.specs = append(g.matchers, m), append(g.names, p.Name), append(g.specs, p.Name+" "+p.Tag)
	}
	jobs := make([]Job, 0, len(order))
	for _, u := range order {
		g := groups[u]
		jobs = append(jobs, Job{
			Key: "source/" + u, Layer: "source", Host: hostOf(u), Packages: g.names, Spec: spec(g.repo, g.specs),
			Poll: func(ctx context.Context) ([]model.Obs, error) {
				tags, err := src.Tags(ctx, g.repo)
				if err != nil {
					return nil, err
				}
				return TagObservations(tags, g.names, g.matchers), nil
			},
		})
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
