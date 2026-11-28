package declare

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"regexp"
	"slices"
	"strings"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
)

// Defaults filled in by Resolve.
const (
	DefaultGitHubAPI   = "https://api.github.com"
	DefaultGitHubWeb   = "https://github.com"
	DefaultNPMRegistry = "https://registry.npmjs.org"
	dockerHubRegistry  = "registry-1.docker.io"
)

// Env is where secret references are checked: the process environment and
// files. Resolve only checks that a referenced secret is there; its value is
// read again where it is used and never stored.
type Env struct {
	Getenv   func(string) string
	ReadFile func(string) ([]byte, error)
}

// OSEnv is the real environment.
func OSEnv() Env { return Env{Getenv: os.Getenv, ReadFile: os.ReadFile} }

// Resolve turns the file into a catalog: defaults cascade from project to
// package, short forms are expanded, and everything is validated. All errors
// are reported together; on error the catalog is not usable.
func (f *File) Resolve(env Env) (catalog.Catalog, error) {
	r := resolver{env: env}
	c := catalog.Catalog{GitHub: r.github(f.GitHub), Targets: r.targets(f.Targets), CDEvents: r.cdevents(f.CDEvents)}
	for i, p := range f.Projects {
		proj, pkgs := r.project(fmt.Sprintf("projects[%d]", i), p, c)
		c.Projects = append(c.Projects, proj)
		c.Packages = append(c.Packages, pkgs...)
	}
	r.crossChecks(c)
	r.cdeventsPackages(c)
	return c, errors.Join(r.errs...)
}

type resolver struct {
	env  Env
	errs []error
}

func (r *resolver) fail(path, format string, args ...any) {
	r.errs = append(r.errs, fmt.Errorf("%s: %s", path, fmt.Sprintf(format, args...)))
}

// secret checks a reference: at most one of env and file, and present when
// set (or required).
func (r *resolver) secret(path, envName, file string, required bool) catalog.SecretRef {
	ref := catalog.SecretRef{Env: envName, File: file}
	switch {
	case envName != "" && file != "":
		r.fail(path, "set either the _env or the _file reference, not both")
	case envName != "" && strings.TrimSpace(r.env.Getenv(envName)) == "":
		r.fail(path, "environment variable %s is empty or unset", envName)
	case file != "":
		if b, err := r.env.ReadFile(file); err != nil {
			r.fail(path, "cannot read %s: %v", file, err)
		} else if strings.TrimSpace(string(b)) == "" {
			r.fail(path, "%s is empty", file)
		}
	case required && ref.IsZero():
		r.fail(path, "a secret reference (_env or _file) is required")
	}
	return ref
}

func (r *resolver) github(g *GitHubFile) *catalog.GitHubApp {
	if g == nil {
		return nil
	}
	app := &catalog.GitHubApp{
		AppID:         g.AppID,
		PrivateKey:    r.secret("github.private_key", g.PrivateKeyEnv, g.PrivateKeyFile, true),
		WebhookSecret: r.secret("github.webhook_secret", g.WebhookSecretEnv, g.WebhookSecretFile, false),
		APIURL:        strings.TrimSuffix(or(g.APIURL, DefaultGitHubAPI), "/"),
		WebURL:        strings.TrimSuffix(or(g.WebURL, DefaultGitHubWeb), "/"),
	}
	if g.AppID <= 0 {
		r.fail("github.app_id", "must be the App's numeric id")
	}
	r.httpURL("github.api_url", app.APIURL)
	r.httpURL("github.web_url", app.WebURL)
	return app
}

func (r *resolver) targets(ts map[string]TargetFile) []catalog.Target {
	names := sortedKeys(ts)
	out := make([]catalog.Target, 0, len(names))
	for _, name := range names {
		t, path := ts[name], "targets."+name
		r.name(path, name)
		ct := catalog.Target{Name: name, Limit: t.Limit}
		if ct.Limit == 0 {
			ct.Limit = 1
		}
		if ct.Limit < 0 {
			r.fail(path+".limit", "must be at least 1")
		}
		if t.Coolify == nil {
			r.fail(path, "needs a runtime: coolify")
		} else {
			ct.Coolify = &catalog.Coolify{
				URL:   strings.TrimSuffix(t.Coolify.URL, "/"),
				Token: r.secret(path+".coolify.token", t.Coolify.TokenEnv, t.Coolify.TokenFile, true),
			}
			r.httpURL(path+".coolify.url", ct.Coolify.URL)
		}
		out = append(out, ct)
	}
	return out
}

func (r *resolver) project(path string, p ProjectFile, c catalog.Catalog) (catalog.Project, []catalog.Package) {
	r.name(path+".name", p.Name)
	if p.Name != "" {
		path = "projects." + p.Name
	}
	repo := r.repo(path+".repo", p.Repo, c.GitHub)
	tag := or(p.Tag, catalog.DefaultTag)
	var pkgs []catalog.Package
	if len(p.Packages) == 0 {
		r.fail(path+".packages", "a project needs at least one package")
	}
	for _, name := range sortedKeys(p.Packages) {
		pkgs = append(pkgs, r.pkg(path+".packages."+name, name, p, repo, tag, c))
	}
	return catalog.Project{Name: p.Name, Repo: repo}, pkgs
}

var ownerName = regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`)

func (r *resolver) repo(path string, f RepoFile, gh *catalog.GitHubApp) catalog.Repo {
	switch {
	case f.GitHub != "" && f.Git != "":
		r.fail(path, "set either github or git, not both")
	case f.GitHub != "":
		if !ownerName.MatchString(f.GitHub) {
			r.fail(path, "%q is not owner/name", f.GitHub)
		}
		if f.User != "" || f.TokenEnv != "" || f.TokenFile != "" {
			r.fail(path, "a GitHub repo is read through the GitHub App; user and token_* are for git remotes")
		}
		web := DefaultGitHubWeb
		if gh != nil {
			web = gh.WebURL
		}
		return catalog.Repo{GitHub: f.GitHub, URL: web + "/" + f.GitHub + ".git"}
	case f.Git != "":
		r.httpURL(path+".git", f.Git)
		return catalog.Repo{URL: f.Git, User: f.User, Auth: r.secret(path, f.TokenEnv, f.TokenFile, false)}
	default:
		r.fail(path, "is required: owner/name or {git: <clone url>}")
	}
	return catalog.Repo{}
}

func (r *resolver) pkg(path, name string, p ProjectFile, repo catalog.Repo, tag string, c catalog.Catalog) catalog.Package {
	r.name(path, name)
	f := p.Packages[name]
	out := catalog.Package{
		Name: name, Project: p.Name, Repo: repo, Tag: or(f.Tag, tag),
		Branch: r.branch(path+".branch", or(f.Branch, p.Branch)), Path: r.pkgPath(path+".path", f.Path),
	}
	release := p.Release
	if f.Release != nil {
		release = f.Release
	}
	out.Release = r.release(path+".release", release, name, repo, c.GitHub)
	if !strings.Contains(out.Tag, "{version}") {
		r.fail(path+".tag", "%q has no {version}", out.Tag)
	} else if _, err := catalog.NewTagMatcher(out.Tag, name); err != nil {
		r.fail(path+".tag", "%v", err)
	}
	ci := p.CI
	if f.CI != nil {
		ci = f.CI
	}
	out.CI = r.ci(path+".ci", ci, name, repo)
	if f.Artifact != nil {
		out.Artifact = r.artifact(path+".artifact", *f.Artifact)
	}
	for i, d := range f.Deploy {
		out.Deploy = append(out.Deploy, r.deploy(fmt.Sprintf("%s.deploy[%d]", path, i), d, c))
	}
	return out
}

var validName = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{0,62}$`)

func (r *resolver) name(path, name string) {
	if !validName.MatchString(name) {
		r.fail(path, "%q is not a valid name (lower-case letters, digits, . _ -)", name)
	}
}

func (r *resolver) httpURL(path, s string) {
	u, err := url.Parse(s)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		r.fail(path, "%q is not an http(s) URL", s)
	}
}

func or(s, def string) string {
	if s == "" {
		return def
	}
	return s
}

func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	slices.Sort(keys)
	return keys
}
