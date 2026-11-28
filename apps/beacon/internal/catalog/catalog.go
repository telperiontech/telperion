// Package catalog is Beacon's resolved configuration: projects, packages and
// their adapter bindings per stage, and runtime targets. The YAML file
// (internal/declare) resolves into it, the store keeps it, and the observation
// loop builds its polls from it. Secrets appear only as references.
package catalog

import (
	"slices"

	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

// Catalog is the whole configuration.
type Catalog struct {
	GitHub   *GitHubApp `json:"github,omitempty"`
	Targets  []Target   `json:"targets"`
	Projects []Project  `json:"projects"`
	Packages []Package  `json:"packages"`
}

// SecretRef names where a secret comes from: an environment variable or a file.
type SecretRef struct {
	Env  string `json:"env,omitempty"`
	File string `json:"file,omitempty"`
}

// IsZero reports whether no secret is referenced.
func (r SecretRef) IsZero() bool { return r.Env == "" && r.File == "" }

// GitHubApp is the GitHub App Beacon reads GitHub through.
type GitHubApp struct {
	AppID      int64     `json:"appId"`
	PrivateKey SecretRef `json:"privateKey"`
	APIURL     string    `json:"apiUrl"` // https://api.github.com, or GHES / a test server
	WebURL     string    `json:"webUrl"` // https://github.com; git and links
}

// Project groups repos' packages with shared defaults (already applied to its
// packages).
type Project struct {
	Name string `json:"name"`
	Repo Repo   `json:"repo"`
}

// Repo is a git repository.
type Repo struct {
	// GitHub "owner/name" when the repo is on GitHub (the App is used for
	// it); "" for a plain git remote.
	GitHub string `json:"github,omitempty"`
	// URL is the clone URL (https).
	URL  string    `json:"url"`
	User string    `json:"user,omitempty"` // basic auth user for a plain git remote
	Auth SecretRef `json:"auth,omitzero"`  // token or password for a plain git remote
}

// Package is something released on its own, with the adapters of its stages.
type Package struct {
	Name     string    `json:"name"`
	Project  string    `json:"project"`
	Repo     Repo      `json:"repo"`
	Tag      string    `json:"tag"` // tag pattern, e.g. "{package}-v{version}"
	CI       *CI       `json:"ci,omitempty"`
	Artifact *Artifact `json:"artifact,omitempty"`
	Deploy   []Deploy  `json:"deploy,omitempty"`
}

// CI binds the built stage.
type CI struct {
	GitHubActions *GitHubActions `json:"githubActions,omitempty"`
}

// GitHubActions watches the runs of one workflow file.
type GitHubActions struct {
	Workflow string `json:"workflow"` // file name, e.g. js-utils.publish.yml
}

// Artifact binds the published stage: exactly one field is set.
type Artifact struct {
	NPM *NPM `json:"npm,omitempty"`
	OCI *OCI `json:"oci,omitempty"`
}

// NPM is a package on an npm-compatible registry.
type NPM struct {
	Name     string    `json:"name"`     // e.g. @telperion/js-utils
	Registry string    `json:"registry"` // e.g. https://registry.npmjs.org
	Token    SecretRef `json:"token,omitzero"`
}

// OCI is an image repository on a distribution-spec registry.
type OCI struct {
	Registry  string    `json:"registry"` // host, e.g. ghcr.io
	Name      string    `json:"name"`     // repository, e.g. telperiontech/frp-gate
	Platforms []string  `json:"platforms,omitempty"`
	User      string    `json:"user,omitempty"`
	Token     SecretRef `json:"token,omitzero"`
	Insecure  bool      `json:"insecure,omitempty"` // plain http (tests, local registries)
}

// Deploy binds one deployment target of a package: exactly one of Coolify
// (a configured target) or HTTPCheck.
type Deploy struct {
	Target    string      `json:"target"` // target name; for http-check a name derived from the URL host
	Coolify   *CoolifyApp `json:"coolify,omitempty"`
	HTTPCheck *HTTPCheck  `json:"httpCheck,omitempty"`
}

// CoolifyApp is an application on a Coolify target.
type CoolifyApp struct {
	App string `json:"app"` // application uuid
}

// HTTPCheck reads the running version from a URL.
type HTTPCheck struct {
	URL     string        `json:"url"`
	Version VersionSource `json:"version"`
}

// VersionSource says where the version is in a response: exactly one field.
type VersionSource struct {
	Header string `json:"header,omitempty"` // response header name
	JSON   string `json:"json,omitempty"`   // JSON pointer, e.g. /version
	Regex  string `json:"regex,omitempty"`  // on the body; the first group is the version
}

// Target is a runtime that several packages deploy to.
type Target struct {
	Name    string   `json:"name"`
	Limit   int      `json:"limit"` // concurrent deploys (used from Phase 2)
	Coolify *Coolify `json:"coolify,omitempty"`
}

// Coolify is a Coolify v4 instance.
type Coolify struct {
	URL   string    `json:"url"`
	Token SecretRef `json:"token"`
}

// Chain is the package's configured stages, in order. It always starts with
// tagged and ends at its last configured stage.
func (p Package) Chain() []model.Stage {
	chain := []model.Stage{model.Tagged}
	if p.CI != nil {
		chain = append(chain, model.Built)
	}
	if p.Artifact != nil {
		chain = append(chain, model.Published)
	}
	if len(p.Deploy) > 0 {
		chain = append(chain, model.Deployed)
	}
	return chain
}

// Targets is the names of the package's deployment targets.
func (p Package) Targets() []string {
	out := make([]string, 0, len(p.Deploy))
	for _, d := range p.Deploy {
		out = append(out, d.Target)
	}
	return out
}

// Package returns the package named name.
func (c Catalog) Package(name string) (Package, bool) {
	i := slices.IndexFunc(c.Packages, func(p Package) bool { return p.Name == name })
	if i < 0 {
		return Package{}, false
	}
	return c.Packages[i], true
}

// Target returns the target named name.
func (c Catalog) Target(name string) (Target, bool) {
	i := slices.IndexFunc(c.Targets, func(t Target) bool { return t.Name == name })
	if i < 0 {
		return Target{}, false
	}
	return c.Targets[i], true
}
