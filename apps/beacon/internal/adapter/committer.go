package adapter

import (
	"context"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
)

// File is a file read from a branch of a repo.
type File struct {
	Path    string
	Content []byte
	SHA     string // the blob, for the write that replaces it
}

// FileChange replaces one file's content with a commit on a branch.
type FileChange struct {
	Repo    catalog.Repo
	Branch  string // the branch written to (for a pull request: its base)
	Base    string // the commit the branch is at (for a pull request: where its branch starts)
	Path    string
	Content []byte
	Message string
}

// PRState is a pull request's state.
type PRState string

// Pull request states.
const (
	PROpen   PRState = "open"
	PRMerged PRState = "merged"
	PRClosed PRState = "closed" // without a merge
)

// PullRequest is an opened pull request.
type PullRequest struct {
	Number int     `json:"number"`
	URL    string  `json:"url"`
	State  PRState `json:"state"`
	Merge  string  `json:"merge,omitempty"` // the merge commit, when merged
}

// Committer writes files of a repo: as a commit on a branch, or as a pull
// request from a branch of its own. Writes are idempotent: a branch, commit
// or pull request that exists already is reused.
type Committer interface {
	ReadFile(ctx context.Context, repo catalog.Repo, branch, path string) (File, error)
	// Commit replaces the file on c.Branch; old is the blob it replaces. It
	// returns the new commit and a link to it.
	Commit(ctx context.Context, c FileChange, old string) (commit, url string, err error)
	// OpenPR commits the change on the branch head and opens a pull request
	// from head into c.Branch.
	OpenPR(ctx context.Context, c FileChange, head, title, body string) (PullRequest, error)
	PullRequest(ctx context.Context, repo catalog.Repo, number int) (PullRequest, error)
}
