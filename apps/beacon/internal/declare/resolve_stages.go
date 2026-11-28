package declare

import (
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
)

// The adapter bindings of a package: CI, artifact and deployments.

func (r *resolver) ci(path string, f *CIFile, pkg string, repo catalog.Repo) *catalog.CI {
	if f == nil || f.None {
		return nil
	}
	if f.CDEvents {
		return &catalog.CI{CDEvents: true}
	}
	if f.GitHubActions == nil {
		r.fail(path, "needs github-actions (or none, or cdevents)")
		return nil
	}
	if repo.GitHub == "" {
		r.fail(path, "github-actions needs a GitHub repo")
	}
	wf := strings.ReplaceAll(f.GitHubActions.Workflow, "{package}", pkg)
	if wf == "" || strings.Contains(wf, "/") {
		r.fail(path+".github-actions.workflow", "must be a workflow file name, e.g. {package}.publish.yml")
	}
	return &catalog.CI{GitHubActions: &catalog.GitHubActions{Workflow: wf}}
}

func (r *resolver) artifact(path string, f ArtifactFile) *catalog.Artifact {
	switch {
	case (f.NPM == nil) == (f.OCI == nil):
		r.fail(path, "needs exactly one of npm or oci")
		return nil
	case f.NPM != nil:
		n := catalog.NPM{
			Name:     f.NPM.Name,
			Registry: strings.TrimSuffix(or(f.NPM.Registry, DefaultNPMRegistry), "/"),
			Token:    r.secret(path+".npm.token", f.NPM.TokenEnv, f.NPM.TokenFile, false),
		}
		if n.Name == "" || strings.ContainsAny(n.Name, " \t") {
			r.fail(path+".npm", "needs the package name, e.g. @scope/name")
		}
		r.httpURL(path+".npm.registry", n.Registry)
		return &catalog.Artifact{NPM: &n}
	}
	reg, name, err := splitImage(f.OCI.Image)
	if err != nil {
		r.fail(path+".oci", "%v", err)
	}
	return &catalog.Artifact{OCI: &catalog.OCI{
		Registry: reg, Name: name, Platforms: f.OCI.Platforms, User: f.OCI.User, Insecure: f.OCI.Insecure,
		Token: r.secret(path+".oci.token", f.OCI.TokenEnv, f.OCI.TokenFile, false),
	}}
}

// splitImage splits an image reference without tag into registry host and
// repository name, with Docker Hub's defaults.
func splitImage(ref string) (registry, name string, err error) {
	last := ref[strings.LastIndex(ref, "/")+1:]
	if ref == "" || strings.Contains(ref, "@") || strings.Contains(last, ":") {
		return "", "", fmt.Errorf("%q must be an image repository without tag or digest, e.g. ghcr.io/owner/name", ref)
	}
	first, rest, ok := strings.Cut(ref, "/")
	if ok && (strings.ContainsAny(first, ".:") || first == "localhost") {
		return first, rest, nil
	}
	if !strings.Contains(ref, "/") {
		ref = "library/" + ref
	}
	return dockerHubRegistry, ref, nil
}

func (r *resolver) deploy(path string, d DeployFile, c catalog.Catalog) catalog.Deploy {
	if d.CDEvents != nil {
		r.name(path+".cdevents.environment", d.CDEvents.Environment)
		return catalog.Deploy{Target: d.CDEvents.Environment, CDEvents: true}
	}
	if d.HTTPCheck != nil {
		h := d.HTTPCheck
		u, err := url.Parse(h.URL)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
			r.fail(path+".http-check.url", "%q is not an http(s) URL", h.URL)
			return catalog.Deploy{}
		}
		r.versionSource(path+".http-check.version", h.Version)
		return catalog.Deploy{
			Target:    or(h.Name, u.Hostname()),
			HTTPCheck: &catalog.HTTPCheck{URL: h.URL, Version: catalog.VersionSource(h.Version)},
		}
	}
	app := ""
	if d.Coolify != nil {
		app = d.Coolify.App
	}
	t, ok := c.Target(d.Target)
	switch {
	case !ok:
		r.fail(path, "unknown target %q (define it under targets)", d.Target)
	case t.Coolify != nil && app == "":
		r.fail(path, "a Coolify target needs app: <application uuid>")
	}
	return catalog.Deploy{Target: d.Target, Coolify: &catalog.CoolifyApp{App: app}}
}

func (r *resolver) versionSource(path string, v VersionFile) {
	set := 0
	for _, s := range []string{v.Header, v.JSON, v.Regex} {
		if s != "" {
			set++
		}
	}
	if set != 1 {
		r.fail(path, "needs exactly one of header, json or regex")
	}
	if v.JSON != "" && !strings.HasPrefix(v.JSON, "/") {
		r.fail(path+".json", "%q is not a JSON pointer (starts with /)", v.JSON)
	}
	if v.Regex != "" {
		if re, err := regexp.Compile(v.Regex); err != nil {
			r.fail(path+".regex", "%v", err)
		} else if re.NumSubexp() < 1 {
			r.fail(path+".regex", "needs a group around the version")
		}
	}
}
