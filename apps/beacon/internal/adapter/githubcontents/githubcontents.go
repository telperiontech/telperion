// Package githubcontents writes files of a GitHub repo through the contents
// API: a commit on a branch, or a branch and a pull request. The update-deps
// step uses it to set dependency ranges in a package.json.
package githubcontents

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/githubapi"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
)

// Committer implements adapter.Committer.
type Committer struct {
	API githubapi.API
}

var _ adapter.Committer = Committer{}

// ErrNotGitHub: the repo is not on GitHub.
var ErrNotGitHub = errors.New("writing files needs a GitHub repo")

// ReadFile reads a file at the head of branch, with the read token.
func (c Committer) ReadFile(ctx context.Context, repo catalog.Repo, branch, path string) (adapter.File, error) {
	return c.read(ctx, githubapi.Call{Repo: repo.GitHub}, branch, path)
}

// Commit replaces the file on ch.Branch.
func (c Committer) Commit(ctx context.Context, ch adapter.FileChange, old string) (string, string, error) {
	return c.put(ctx, githubapi.Call{Repo: ch.Repo.GitHub, Write: true}, ch, ch.Branch, old)
}

// OpenPR finds a pull request from head (open or not) and returns it, or
// creates the branch head at ch.Base (unless it exists), commits the change
// there (unless the file has that content already) and opens a pull request
// into ch.Branch.
func (c Committer) OpenPR(ctx context.Context, ch adapter.FileChange, head, title, body string) (adapter.PullRequest, error) {
	if ch.Repo.GitHub == "" {
		return adapter.PullRequest{}, ErrNotGitHub
	}
	call := githubapi.Call{Repo: ch.Repo.GitHub, PullRequests: true}
	prs, err := c.find(ctx, call, head)
	if err != nil || len(prs) > 0 {
		if err != nil {
			return adapter.PullRequest{}, err
		}
		return prs[0], nil
	}
	if err := c.branch(ctx, call, head, ch.Base); err != nil {
		return adapter.PullRequest{}, err
	}
	f, err := c.read(ctx, call, head, ch.Path)
	if err != nil {
		return adapter.PullRequest{}, err
	}
	if !bytes.Equal(f.Content, ch.Content) {
		if _, _, err := c.put(ctx, call, ch, head, f.SHA); err != nil {
			return adapter.PullRequest{}, err
		}
	}
	open := call
	open.Method, open.Path = http.MethodPost, "/pulls"
	open.Body = map[string]string{"title": title, "head": head, "base": ch.Branch, "body": body}
	var pr pull
	if err := c.API.Do(ctx, open, &pr); err != nil {
		return adapter.PullRequest{}, fmt.Errorf("open the pull request: %w", err)
	}
	return pr.state(), nil
}

// PullRequest reads a pull request's state (with the pull request token: the
// read token has no access to pull requests).
func (c Committer) PullRequest(ctx context.Context, repo catalog.Repo, number int) (adapter.PullRequest, error) {
	if repo.GitHub == "" {
		return adapter.PullRequest{}, ErrNotGitHub
	}
	var pr pull
	err := c.API.Do(ctx, githubapi.Call{Repo: repo.GitHub, Path: "/pulls/" + strconv.Itoa(number), PullRequests: true}, &pr)
	return pr.state(), err
}

type contents struct {
	Content  string `json:"content"`
	Encoding string `json:"encoding"`
	SHA      string `json:"sha"`
}

func (c Committer) read(ctx context.Context, call githubapi.Call, branch, path string) (adapter.File, error) {
	if call.Repo == "" {
		return adapter.File{}, ErrNotGitHub
	}
	call.Path = "/contents/" + escapePath(path) + "?ref=" + url.QueryEscape(branch)
	var out contents
	if err := c.API.Do(ctx, call, &out); err != nil {
		return adapter.File{}, fmt.Errorf("read %s on %s: %w", path, branch, err)
	}
	if out.Encoding != "base64" {
		return adapter.File{}, fmt.Errorf("read %s: unexpected encoding %q (a file over 1 MB?)", path, out.Encoding)
	}
	b, err := base64.StdEncoding.DecodeString(strings.ReplaceAll(out.Content, "\n", ""))
	if err != nil {
		return adapter.File{}, fmt.Errorf("read %s: %w", path, err)
	}
	return adapter.File{Path: path, Content: b, SHA: out.SHA}, nil
}

func (c Committer) put(ctx context.Context, call githubapi.Call, ch adapter.FileChange, branch, old string) (string, string, error) {
	if call.Repo == "" {
		return "", "", ErrNotGitHub
	}
	call.Method, call.Path = http.MethodPut, "/contents/"+escapePath(ch.Path)
	call.Body = map[string]string{
		"message": ch.Message, "content": base64.StdEncoding.EncodeToString(ch.Content), "sha": old, "branch": branch,
	}
	var out struct {
		Commit struct {
			SHA     string `json:"sha"`
			HTMLURL string `json:"html_url"`
		} `json:"commit"`
	}
	if err := c.API.Do(ctx, call, &out); err != nil {
		return "", "", fmt.Errorf("commit %s to %s: %w", ch.Path, branch, err)
	}
	return out.Commit.SHA, out.Commit.HTMLURL, nil
}

// branch creates the branch head at base, unless it exists.
func (c Committer) branch(ctx context.Context, call githubapi.Call, head, base string) error {
	get := call
	get.Path = "/git/ref/heads/" + escapePath(head)
	err := c.API.Do(ctx, get, nil)
	switch {
	case err == nil:
		return nil
	case !platform.IsStatus(err, http.StatusNotFound):
		return fmt.Errorf("look for the branch %s: %w", head, err)
	}
	create := call
	create.Method, create.Path = http.MethodPost, "/git/refs"
	create.Body = map[string]string{"ref": "refs/heads/" + head, "sha": base}
	if err := c.API.Do(ctx, create, nil); err != nil {
		return fmt.Errorf("create the branch %s: %w", head, err)
	}
	return nil
}

func (c Committer) find(ctx context.Context, call githubapi.Call, head string) ([]adapter.PullRequest, error) {
	owner, _, _ := strings.Cut(call.Repo, "/")
	call.Path = "/pulls?state=all&head=" + url.QueryEscape(owner+":"+head)
	var prs []pull
	if err := c.API.Do(ctx, call, &prs); err != nil {
		return nil, fmt.Errorf("look for a pull request from %s: %w", head, err)
	}
	out := make([]adapter.PullRequest, 0, len(prs))
	for _, p := range prs {
		out = append(out, p.state())
	}
	return out, nil
}

type pull struct {
	Number   int     `json:"number"`
	HTMLURL  string  `json:"html_url"`
	State    string  `json:"state"`
	Merged   bool    `json:"merged"`
	MergedAt *string `json:"merged_at"`
	MergeSHA string  `json:"merge_commit_sha"`
}

func (p pull) state() adapter.PullRequest {
	out := adapter.PullRequest{Number: p.Number, URL: p.HTMLURL, State: adapter.PROpen}
	switch {
	case p.Merged || p.MergedAt != nil:
		out.State, out.Merge = adapter.PRMerged, p.MergeSHA
	case p.State == "closed":
		out.State = adapter.PRClosed
	}
	return out
}

func escapePath(p string) string {
	parts := strings.Split(strings.TrimPrefix(p, "/"), "/")
	for i, s := range parts {
		parts[i] = url.PathEscape(s)
	}
	return strings.Join(parts, "/")
}
