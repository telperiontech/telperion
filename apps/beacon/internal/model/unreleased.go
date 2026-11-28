package model

import "time"

// Unreleased is how far a package's branch is ahead of its latest tag: the
// commits since that tag (within the package's path), shown before the chain.
type Unreleased struct {
	Package string    `json:"package"`
	Tag     string    `json:"tag"`     // the latest tag compared from; "" if the package has none
	Branch  string    `json:"branch"`  // compared to
	Commits int       `json:"commits"` // since Tag, touching the package's path
	URL     string    `json:"url,omitempty"`
	Checked time.Time `json:"checked,omitzero"`
}
