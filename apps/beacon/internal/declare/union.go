package declare

import (
	"fmt"

	"go.yaml.in/yaml/v3"
)

// The types in this file accept a short scalar form next to the full mapping
// (repo: owner/name, npm: "@scope/name", oci: ghcr.io/x/y, ci: none) and write
// the short form back when it says everything.

// RepoFile is a repository: "owner/name" on GitHub, or a mapping.
type RepoFile struct {
	GitHub    string `yaml:"github,omitempty"`
	Git       string `yaml:"git,omitempty"` // clone URL of a plain git remote
	User      string `yaml:"user,omitempty"`
	TokenEnv  string `yaml:"token_env,omitempty"`
	TokenFile string `yaml:"token_file,omitempty"`
}

type repoFile RepoFile

// UnmarshalYAML accepts "owner/name" or the mapping.
func (r *RepoFile) UnmarshalYAML(n *yaml.Node) error {
	if n.Kind == yaml.ScalarNode {
		*r = RepoFile{GitHub: n.Value}
		return nil
	}
	return decodeNode(n, (*repoFile)(r))
}

// MarshalYAML writes "owner/name" for a GitHub repo.
func (r RepoFile) MarshalYAML() (any, error) {
	if r.GitHub != "" && r == (RepoFile{GitHub: r.GitHub}) {
		return r.GitHub, nil
	}
	return repoFile(r), nil
}

// CIFile binds the built stage; "none" turns a project default off.
type CIFile struct {
	None          bool               `yaml:"-"`
	GitHubActions *GitHubActionsFile `yaml:"github-actions,omitempty"`
}

// GitHubActionsFile watches one workflow file's runs.
type GitHubActionsFile struct {
	Workflow string `yaml:"workflow"` // may contain {package}
}

type ciFile CIFile

// UnmarshalYAML accepts "none" or the mapping.
func (c *CIFile) UnmarshalYAML(n *yaml.Node) error {
	if n.Kind == yaml.ScalarNode {
		if n.Value != "none" {
			return fmt.Errorf("line %d: ci must be none or a mapping, got %q", n.Line, n.Value)
		}
		*c = CIFile{None: true}
		return nil
	}
	return decodeNode(n, (*ciFile)(c))
}

// MarshalYAML writes "none" for a disabled CI.
func (c CIFile) MarshalYAML() (any, error) {
	if c.None {
		return "none", nil
	}
	return ciFile(c), nil
}

// NPMFile is an npm package: its name, or a mapping with a registry.
type NPMFile struct {
	Name      string `yaml:"name"`
	Registry  string `yaml:"registry,omitempty"` // default https://registry.npmjs.org
	TokenEnv  string `yaml:"token_env,omitempty"`
	TokenFile string `yaml:"token_file,omitempty"`
}

type npmFile NPMFile

// UnmarshalYAML accepts "@scope/name" or the mapping.
func (p *NPMFile) UnmarshalYAML(n *yaml.Node) error {
	if n.Kind == yaml.ScalarNode {
		*p = NPMFile{Name: n.Value}
		return nil
	}
	return decodeNode(n, (*npmFile)(p))
}

// MarshalYAML writes the name alone when the rest is default.
func (p NPMFile) MarshalYAML() (any, error) {
	if p == (NPMFile{Name: p.Name}) {
		return p.Name, nil
	}
	return npmFile(p), nil
}

// OCIFile is an image repository: its reference, or a mapping.
type OCIFile struct {
	Image     string   `yaml:"image"`               // e.g. ghcr.io/telperiontech/frp-gate
	Platforms []string `yaml:"platforms,omitempty"` // expected, e.g. [linux/amd64, linux/arm64]
	User      string   `yaml:"user,omitempty"`
	TokenEnv  string   `yaml:"token_env,omitempty"`
	TokenFile string   `yaml:"token_file,omitempty"`
	Insecure  bool     `yaml:"insecure,omitempty"` // plain http
}

type ociFile OCIFile

// UnmarshalYAML accepts the image reference or the mapping.
func (o *OCIFile) UnmarshalYAML(n *yaml.Node) error {
	if n.Kind == yaml.ScalarNode {
		*o = OCIFile{Image: n.Value}
		return nil
	}
	return decodeNode(n, (*ociFile)(o))
}

// MarshalYAML writes the reference alone when the rest is default.
func (o OCIFile) MarshalYAML() (any, error) {
	if len(o.Platforms) == 0 && o.User == "" && o.TokenEnv == "" && o.TokenFile == "" && !o.Insecure {
		return o.Image, nil
	}
	return ociFile(o), nil
}

// DeployFile is one deployment target of a package, written as a one-key
// mapping: "<target name>: {app: ...}" for a configured target, or
// "http-check: {...}".
type DeployFile struct {
	Target    string          // configured target name ("" for http-check)
	Coolify   *CoolifyAppFile // settings for a configured (Coolify) target
	HTTPCheck *HTTPCheckFile
}

// UnmarshalYAML reads the one-key mapping.
func (d *DeployFile) UnmarshalYAML(n *yaml.Node) error {
	if n.Kind != yaml.MappingNode || len(n.Content) != 2 {
		return fmt.Errorf("line %d: a deploy entry is a mapping with one key: a target name or http-check", n.Line)
	}
	key, val := n.Content[0].Value, n.Content[1]
	if key == "http-check" {
		d.HTTPCheck = &HTTPCheckFile{}
		return decodeNode(val, d.HTTPCheck)
	}
	d.Target, d.Coolify = key, &CoolifyAppFile{}
	return decodeNode(val, d.Coolify)
}

// MarshalYAML writes the one-key mapping.
func (d DeployFile) MarshalYAML() (any, error) {
	if d.HTTPCheck != nil {
		return map[string]*HTTPCheckFile{"http-check": d.HTTPCheck}, nil
	}
	return map[string]*CoolifyAppFile{d.Target: d.Coolify}, nil
}
