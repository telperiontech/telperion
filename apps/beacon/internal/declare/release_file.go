package declare

import (
	"fmt"

	"go.yaml.in/yaml/v3"
)

// ReleaseFile is a package's release trigger: one of github-release,
// github-dispatch or webhook; "none" turns a project default off.
type ReleaseFile struct {
	None           bool                `yaml:"-"`
	GitHubRelease  *GitHubReleaseFile  `yaml:"github-release,omitempty"`
	GitHubDispatch *GitHubDispatchFile `yaml:"github-dispatch,omitempty"`
	Webhook        *WebhookFile        `yaml:"webhook,omitempty"`
}

// GitHubReleaseFile creates a GitHub release (or only the tag) at the branch
// head.
type GitHubReleaseFile struct {
	Notes   string `yaml:"notes,omitempty"`    // generate (default) | none
	TagOnly bool   `yaml:"tag_only,omitempty"` // only the tag, no release
}

// GitHubDispatchFile starts a workflow_dispatch run.
type GitHubDispatchFile struct {
	Workflow string            `yaml:"workflow"`         // may contain {package}
	Inputs   map[string]string `yaml:"inputs,omitempty"` // default {package: "{package}", version: "{version}"}
}

// WebhookFile POSTs the release request to a URL, HMAC-signed.
type WebhookFile struct {
	URL        string `yaml:"url"`
	SecretEnv  string `yaml:"secret_env,omitempty"`
	SecretFile string `yaml:"secret_file,omitempty"`
}

type releaseFile ReleaseFile

// UnmarshalYAML accepts "none" or the mapping.
func (r *ReleaseFile) UnmarshalYAML(n *yaml.Node) error {
	if n.Kind == yaml.ScalarNode {
		if n.Value != "none" {
			return fmt.Errorf("line %d: release must be none or a mapping, got %q", n.Line, n.Value)
		}
		*r = ReleaseFile{None: true}
		return nil
	}
	return decodeNode(n, (*releaseFile)(r))
}

// MarshalYAML writes "none" for a disabled trigger.
func (r ReleaseFile) MarshalYAML() (any, error) {
	if r.None {
		return "none", nil
	}
	return releaseFile(r), nil
}
