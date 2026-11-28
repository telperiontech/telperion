package catalog

// Release is the trigger that starts a package's release: exactly one field
// is set. Beacon computes the version and tag; the trigger only fires.
type Release struct {
	GitHubRelease  *GitHubRelease  `json:"githubRelease,omitempty"`
	GitHubDispatch *GitHubDispatch `json:"githubDispatch,omitempty"`
	Webhook        *Webhook        `json:"webhook,omitempty"`
}

// Kind is the trigger's config name.
func (r Release) Kind() string {
	switch {
	case r.GitHubRelease != nil:
		return "github-release"
	case r.GitHubDispatch != nil:
		return "github-dispatch"
	case r.Webhook != nil:
		return "webhook"
	}
	return ""
}

// GitHubRelease creates a GitHub release with a new tag at the branch head
// (the `gh release create` equivalent), or only the tag.
type GitHubRelease struct {
	Notes   string `json:"notes"`             // generate | none
	TagOnly bool   `json:"tagOnly,omitempty"` // create the tag (Git refs API), no release
}

// Release notes settings.
const (
	NotesGenerate = "generate"
	NotesNone     = "none"
)

// GitHubDispatch starts a workflow_dispatch run whose workflow creates the
// release.
type GitHubDispatch struct {
	Workflow string `json:"workflow"` // file name
	// Inputs are the workflow's inputs; values may use {package}, {version},
	// {tag} and {bump}.
	Inputs map[string]string `json:"inputs"`
}

// Webhook POSTs the release request as HMAC-signed JSON to a URL.
type Webhook struct {
	URL    string    `json:"url"`
	Secret SecretRef `json:"secret"`
}

// CDEventsSource may push CDEvents to /cdevents with its bearer token.
type CDEventsSource struct {
	Name     string    `json:"name"`
	Token    SecretRef `json:"token"`
	Packages []string  `json:"packages,omitempty"` // what it may report on; empty: every package
}

// Allows reports whether the source may report on pkg.
func (s CDEventsSource) Allows(pkg string) bool {
	if len(s.Packages) == 0 {
		return true
	}
	for _, p := range s.Packages {
		if p == pkg {
			return true
		}
	}
	return false
}
