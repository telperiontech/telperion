// Package githubapi makes GitHub REST calls for a repo with the App's tokens:
// a read token for reads, a repo-scoped write token for writes. The GitHub
// adapters (actions, release, dispatch, compare) share it.
package githubapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
)

// API is GitHub's REST API (api.github.com or a GHES / test URL).
type API struct {
	Client *platform.Client
	URL    string // e.g. https://api.github.com
	Tokens adapter.GitHubTokens
}

// Call is one request about a repo.
type Call struct {
	Method string // default GET
	Repo   string // owner/name
	Path   string // after /repos/{owner}/{name}, e.g. /releases
	Body   any    // JSON-encoded when set
	Write  bool   // use a write token
	// PullRequests: use a token that may also open pull requests (it can
	// read and write them); implies Write.
	PullRequests bool
	// ETagKey makes the request conditional (platform.ErrNotModified when
	// nothing changed); it scopes the remembered ETag.
	ETagKey string
}

// Do sends c and decodes a JSON answer into out (nil: the body is ignored,
// e.g. 204 No Content).
func (a API) Do(ctx context.Context, c Call, out any) error {
	tok, err := a.token(ctx, c)
	if err != nil {
		return err
	}
	h := http.Header{}
	h.Set("Accept", "application/vnd.github+json")
	h.Set("X-GitHub-Api-Version", "2022-11-28")
	if tok != "" {
		h.Set("Authorization", "Bearer "+tok)
	}
	r := platform.Request{
		Method: c.Method, URL: a.URL + "/repos/" + c.Repo + c.Path, Header: h,
		Conditional: c.ETagKey != "", ETagKey: c.ETagKey,
	}
	if c.Body != nil {
		b, err := json.Marshal(c.Body)
		if err != nil {
			return err
		}
		r.Body = bytes.NewReader(b)
		h.Set("Content-Type", "application/json")
	}
	return a.Client.Do(ctx, r, func(resp *http.Response) error {
		if out == nil {
			_, err := io.Copy(io.Discard, resp.Body)
			return err
		}
		return json.NewDecoder(resp.Body).Decode(out)
	})
}

func (a API) token(ctx context.Context, c Call) (string, error) {
	switch {
	case c.PullRequests:
		return a.Tokens.PullRequestToken(ctx, c.Repo)
	case c.Write:
		return a.Tokens.WriteToken(ctx, c.Repo)
	}
	return a.Tokens.Token(ctx, c.Repo)
}

// RefExists reports whether a git ref (e.g. "tags/js-utils-v1.0.0") exists,
// reading with the token for reads.
func (a API) RefExists(ctx context.Context, repo, ref string) (bool, error) {
	err := a.Do(ctx, Call{Repo: repo, Path: "/git/ref/" + ref}, nil)
	switch {
	case err == nil:
		return true, nil
	case platform.IsStatus(err, http.StatusNotFound):
		return false, nil
	}
	return false, err
}
