// Package declare is Beacon's YAML config file: strict parsing, defaults,
// validation, the diff against the stored catalog, apply in one transaction,
// and export back to YAML. Secrets are never in the file, only references
// (*_env, *_file).
package declare

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"

	"go.yaml.in/yaml/v3"
)

// File is the config file as written.
type File struct {
	GitHub   *GitHubFile           `yaml:"github,omitempty"`
	Targets  map[string]TargetFile `yaml:"targets,omitempty"`
	CDEvents *CDEventsFile         `yaml:"cdevents,omitempty"`
	Projects []ProjectFile         `yaml:"projects"`
}

// GitHubFile is the GitHub App Beacon reads (and releases) through.
type GitHubFile struct {
	AppID             int64  `yaml:"app_id"`
	PrivateKeyFile    string `yaml:"private_key_file,omitempty"`
	PrivateKeyEnv     string `yaml:"private_key_env,omitempty"`
	WebhookSecretEnv  string `yaml:"webhook_secret_env,omitempty"`
	WebhookSecretFile string `yaml:"webhook_secret_file,omitempty"`
	APIURL            string `yaml:"api_url,omitempty"` // default https://api.github.com
	WebURL            string `yaml:"web_url,omitempty"` // default https://github.com
}

// CDEventsFile lists who may push CDEvents to /cdevents.
type CDEventsFile struct {
	Sources []CDEventsSourceFile `yaml:"sources"`
}

// CDEventsSourceFile is one sender with its own bearer token.
type CDEventsSourceFile struct {
	Name      string   `yaml:"name"`
	TokenEnv  string   `yaml:"token_env,omitempty"`
	TokenFile string   `yaml:"token_file,omitempty"`
	Packages  []string `yaml:"packages,omitempty"` // what it may report on; default every package
}

// TargetFile is a runtime target.
type TargetFile struct {
	Coolify *CoolifyFile `yaml:"coolify,omitempty"`
	Limit   int          `yaml:"limit,omitempty"` // concurrent deploys, default 1
}

// CoolifyFile is a Coolify v4 instance.
type CoolifyFile struct {
	URL       string `yaml:"url"`
	TokenEnv  string `yaml:"token_env,omitempty"`
	TokenFile string `yaml:"token_file,omitempty"`
}

// ProjectFile groups packages of one repo with shared defaults.
type ProjectFile struct {
	Name     string                 `yaml:"name"`
	Repo     RepoFile               `yaml:"repo"`
	Tag      string                 `yaml:"tag,omitempty"`    // default {package}-v{version}
	Branch   string                 `yaml:"branch,omitempty"` // default: the repo's default branch
	Release  *ReleaseFile           `yaml:"release,omitempty"`
	CI       *CIFile                `yaml:"ci,omitempty"`
	Packages map[string]PackageFile `yaml:"packages"`
}

// PackageFile is one package; it states only what differs from its project.
type PackageFile struct {
	Tag      string        `yaml:"tag,omitempty"`
	Branch   string        `yaml:"branch,omitempty"`
	Path     string        `yaml:"path,omitempty"` // the package's folder, for unreleased changes
	Release  *ReleaseFile  `yaml:"release,omitempty"`
	CI       *CIFile       `yaml:"ci,omitempty"`
	Artifact *ArtifactFile `yaml:"artifact,omitempty"`
	Deploy   []DeployFile  `yaml:"deploy,omitempty"`
}

// ArtifactFile binds the published stage: npm or oci.
type ArtifactFile struct {
	NPM *NPMFile `yaml:"npm,omitempty"`
	OCI *OCIFile `yaml:"oci,omitempty"`
}

// HTTPCheckFile reads the running version from a URL.
type HTTPCheckFile struct {
	Name    string      `yaml:"name,omitempty"` // target name; default the URL's host
	URL     string      `yaml:"url"`
	Version VersionFile `yaml:"version"`
}

// VersionFile says where the version is in the response.
type VersionFile struct {
	Header string `yaml:"header,omitempty"`
	JSON   string `yaml:"json,omitempty"`
	Regex  string `yaml:"regex,omitempty"`
}

// CoolifyAppFile is an application on a Coolify target.
type CoolifyAppFile struct {
	App string `yaml:"app"`
}

// ParseFile reads and strictly parses a config file.
func ParseFile(path string) (*File, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	f, err := Parse(b)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	return f, nil
}

// Parse strictly parses a config file: unknown keys and a second document are
// errors.
func Parse(b []byte) (*File, error) {
	var f File
	if err := decodeStrict(b, &f); err != nil {
		return nil, err
	}
	return &f, nil
}

func decodeStrict(b []byte, out any) error {
	dec := yaml.NewDecoder(bytes.NewReader(b))
	dec.KnownFields(true)
	if err := dec.Decode(out); err != nil {
		if errors.Is(err, io.EOF) {
			return errors.New("empty file")
		}
		return err
	}
	var extra any
	if err := dec.Decode(&extra); !errors.Is(err, io.EOF) {
		return errors.New("only one YAML document is allowed")
	}
	return nil
}

// decodeNode decodes a node strictly. yaml.Node.Decode does not keep the
// decoder's KnownFields, so the node is re-encoded and decoded again.
func decodeNode(n *yaml.Node, out any) error {
	b, err := yaml.Marshal(n)
	if err != nil {
		return err
	}
	if err := decodeStrict(b, out); err != nil {
		return fmt.Errorf("line %d: %w", n.Line, err)
	}
	return nil
}
