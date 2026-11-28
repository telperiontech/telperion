// Package gitsource lists a repository's tags over git's smart HTTP protocol:
// the ref advertisement of GET <repo>/info/refs?service=git-upload-pack, which
// is what `git ls-remote --tags` reads. Any git host, no git binary, no clone.
// For GitHub repos it authenticates with the App's installation token, and
// GitHub does not count these requests against the REST rate limit.
package gitsource

import (
	"bufio"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
	"github.com/telperiontech/telperion/apps/beacon/internal/secret"
)

// Source implements adapter.Source.
type Source struct {
	Client *platform.Client
	GitHub adapter.GitHubTokens
}

var _ adapter.Source = Source{}

// Refs reads the repo's ref advertisement.
func (s Source) Refs(ctx context.Context, repo catalog.Repo) (adapter.Refs, error) {
	h := http.Header{}
	h.Set("User-Agent", "git/2.0 (beacon)") // some hosts expect a git client
	user, pass, err := s.credentials(ctx, repo)
	if err != nil {
		return adapter.Refs{}, err
	}
	if pass != "" {
		h.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(user+":"+pass)))
	}
	var refs adapter.Refs
	err = s.Client.Do(ctx, platform.Request{
		URL: strings.TrimSuffix(repo.URL, "/") + "/info/refs?service=git-upload-pack", Header: h,
	}, func(resp *http.Response) error {
		var err error
		refs, err = ParseAdvertisement(resp.Body)
		return err
	})
	return refs, err
}

func (s Source) credentials(ctx context.Context, repo catalog.Repo) (user, pass string, err error) {
	if repo.GitHub != "" {
		tok, err := s.GitHub.Token(ctx, repo.GitHub)
		return "x-access-token", tok, err
	}
	pass, err = secret.Value(repo.Auth)
	user = repo.User
	if user == "" {
		user = "git"
	}
	return user, pass, err
}

// ParseAdvertisement reads a smart HTTP ref advertisement (pkt-lines) and
// returns its tags, branch heads and default branch (the symref=HEAD:
// capability). Annotated tags report the commit they point at.
func ParseAdvertisement(r io.Reader) (adapter.Refs, error) {
	br := bufio.NewReader(r)
	refs := adapter.Refs{Heads: map[string]string{}}
	commits := map[string]string{}
	var order []string
	for {
		line, flush, err := readPkt(br)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return adapter.Refs{}, err
		}
		if flush || strings.HasPrefix(line, "#") {
			continue
		}
		line, caps, _ := strings.Cut(strings.TrimSuffix(line, "\n"), "\x00") // capabilities after NUL
		for _, c := range strings.Fields(caps) {
			if target, ok := strings.CutPrefix(c, "symref=HEAD:refs/heads/"); ok {
				refs.Default = target
			}
		}
		sha, ref, ok := strings.Cut(line, " ")
		if branch, isHead := strings.CutPrefix(ref, "refs/heads/"); ok && isHead {
			refs.Heads[branch] = sha
			continue
		}
		name, isTag := strings.CutPrefix(ref, "refs/tags/")
		if !ok || !isTag {
			continue
		}
		if base, peeled := strings.CutSuffix(name, "^{}"); peeled {
			commits[base] = sha
			continue
		}
		if _, seen := commits[name]; !seen {
			order = append(order, name)
		}
		commits[name] = sha
	}
	refs.Tags = make([]adapter.Tag, 0, len(order))
	for _, n := range order {
		refs.Tags = append(refs.Tags, adapter.Tag{Name: n, Commit: commits[n]})
	}
	return refs, nil
}

// readPkt reads one pkt-line: four hex digits of length (including
// themselves), then the payload; "0000" is a flush packet.
func readPkt(r *bufio.Reader) (line string, flush bool, err error) {
	var head [4]byte
	if _, err := io.ReadFull(r, head[:]); err != nil {
		return "", false, err
	}
	n, err := strconv.ParseUint(string(head[:]), 16, 16)
	if err != nil {
		return "", false, fmt.Errorf("not a git ref advertisement (bad pkt-line length %q)", head)
	}
	if n == 0 {
		return "", true, nil
	}
	if n < 4 {
		return "", false, fmt.Errorf("bad pkt-line length %d", n)
	}
	buf := make([]byte, n-4)
	if _, err := io.ReadFull(r, buf); err != nil {
		return "", false, err
	}
	return string(buf), false, nil
}
