package declare

import (
	"maps"
	"path"
	"regexp"
	"strings"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
)

// Release triggers, branches, package paths and CDEvents sources.

// defaultDispatchInputs are the workflow_dispatch inputs when none are set.
var defaultDispatchInputs = map[string]string{"package": "{package}", "version": "{version}"}

var placeholder = regexp.MustCompile(`\{[^}]*\}`)

func (r *resolver) release(p string, f *ReleaseFile, pkg string, repo catalog.Repo, gh *catalog.GitHubApp) *catalog.Release {
	if f == nil || f.None {
		return nil
	}
	set := 0
	for _, b := range []bool{f.GitHubRelease != nil, f.GitHubDispatch != nil, f.Webhook != nil} {
		if b {
			set++
		}
	}
	if set != 1 {
		r.fail(p, "needs exactly one of github-release, github-dispatch or webhook (or none)")
		return nil
	}
	if f.Webhook != nil {
		r.httpURL(p+".webhook.url", f.Webhook.URL)
		return &catalog.Release{Webhook: &catalog.Webhook{
			URL: f.Webhook.URL, Secret: r.secret(p+".webhook.secret", f.Webhook.SecretEnv, f.Webhook.SecretFile, true),
		}}
	}
	if repo.GitHub == "" {
		r.fail(p, "github-release and github-dispatch need a GitHub repo")
	}
	if gh == nil {
		r.fail(p, "github-release and github-dispatch write through the GitHub App: configure github first")
	}
	if g := f.GitHubRelease; g != nil {
		notes := or(g.Notes, catalog.NotesGenerate)
		if notes != catalog.NotesGenerate && notes != catalog.NotesNone {
			r.fail(p+".github-release.notes", "must be generate or none")
		}
		return &catalog.Release{GitHubRelease: &catalog.GitHubRelease{Notes: notes, TagOnly: g.TagOnly}}
	}
	d := f.GitHubDispatch
	wf := strings.ReplaceAll(d.Workflow, "{package}", pkg)
	if wf == "" || strings.Contains(wf, "/") {
		r.fail(p+".github-dispatch.workflow", "must be a workflow file name, e.g. release.yml")
	}
	inputs := maps.Clone(d.Inputs)
	if len(inputs) == 0 {
		inputs = maps.Clone(defaultDispatchInputs)
	}
	for k, v := range inputs {
		for _, ph := range placeholder.FindAllString(v, -1) {
			if ph != "{package}" && ph != "{version}" && ph != "{tag}" && ph != "{bump}" {
				r.fail(p+".github-dispatch.inputs."+k, "unknown placeholder %s (use {package}, {version}, {tag}, {bump})", ph)
			}
		}
	}
	return &catalog.Release{GitHubDispatch: &catalog.GitHubDispatch{Workflow: wf, Inputs: inputs}}
}

var validBranch = regexp.MustCompile(`^[A-Za-z0-9._/-]+$`)

func (r *resolver) branch(p, b string) string {
	if b != "" && (!validBranch.MatchString(b) || strings.Contains(b, "..") || strings.HasPrefix(b, "refs/")) {
		r.fail(p, "%q is not a branch name", b)
	}
	return b
}

// pkgPath cleans a repo-relative folder: no leading slash, no "..".
func (r *resolver) pkgPath(p, s string) string {
	if s == "" {
		return ""
	}
	clean := path.Clean(strings.TrimPrefix(s, "./"))
	if strings.HasPrefix(s, "/") || clean == ".." || strings.HasPrefix(clean, "../") || clean == "." {
		r.fail(p, "%q must be a folder inside the repo, e.g. libs/js-utils", s)
		return ""
	}
	return clean
}

func (r *resolver) cdevents(f *CDEventsFile) []catalog.CDEventsSource {
	if f == nil {
		return nil
	}
	out := make([]catalog.CDEventsSource, 0, len(f.Sources))
	seen := map[string]bool{}
	for _, s := range f.Sources {
		p := "cdevents.sources." + s.Name
		r.name(p, s.Name)
		if seen[s.Name] {
			r.fail(p, "duplicate source name")
		}
		seen[s.Name] = true
		out = append(out, catalog.CDEventsSource{
			Name: s.Name, Token: r.secret(p+".token", s.TokenEnv, s.TokenFile, true), Packages: s.Packages,
		})
	}
	return out
}

// cdeventsPackages checks that sources name known packages.
func (r *resolver) cdeventsPackages(c catalog.Catalog) {
	for _, s := range c.CDEvents {
		for _, name := range s.Packages {
			if _, ok := c.Package(name); !ok {
				r.fail("cdevents.sources."+s.Name+".packages", "unknown package %q", name)
			}
		}
	}
}
