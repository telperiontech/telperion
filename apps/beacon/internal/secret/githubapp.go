package secret

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
)

// Permissions of the tokens Beacon mints. Observing needs only read access;
// actions (tags, releases, dispatches, re-runs) get a token with write access
// that is limited to the one repo they act on. The App must have been granted
// at least these, or minting fails.
var (
	ReadPermissions  = map[string]string{"metadata": "read", "contents": "read", "actions": "read"}
	WritePermissions = map[string]string{"metadata": "read", "contents": "write", "actions": "write"}
)

// GitHubApp mints installation tokens for repos: a JWT signed with the App's
// private key finds the repo's installation, and a token for that installation
// is cached until five minutes before it expires. Safe for concurrent use.
type GitHubApp struct {
	cfg    catalog.GitHubApp
	key    *rsa.PrivateKey
	client *platform.Client
	now    func() time.Time

	mu       sync.Mutex
	installs map[string]int64 // owner/name → installation id
	tokens   map[tokenKey]token
}

// tokenKey: read tokens cover the whole installation; write tokens one repo.
type tokenKey struct {
	install int64
	repo    string // "" for a read token
}

type token struct {
	value   string
	expires time.Time
}

// NewGitHubApp reads the App's private key (PKCS#1 or PKCS#8 PEM).
func NewGitHubApp(cfg catalog.GitHubApp, client *platform.Client) (*GitHubApp, error) {
	pemText, err := Value(cfg.PrivateKey)
	if err != nil {
		return nil, fmt.Errorf("GitHub App private key: %w", err)
	}
	key, err := ParseRSAKey([]byte(pemText))
	if err != nil {
		return nil, fmt.Errorf("GitHub App private key: %w", err)
	}
	return &GitHubApp{
		cfg: cfg, key: key, client: client, now: time.Now,
		installs: map[string]int64{}, tokens: map[tokenKey]token{},
	}, nil
}

// ParseRSAKey parses a PEM RSA private key.
func ParseRSAKey(b []byte) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode(b)
	if block == nil {
		return nil, errors.New("not PEM")
	}
	if k, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return k, nil
	}
	k, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, errors.New("not an RSA private key (PKCS#1 or PKCS#8)")
	}
	rk, ok := k.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("not an RSA private key")
	}
	return rk, nil
}

// Token returns a read-only installation token for the repo "owner/name".
func (a *GitHubApp) Token(ctx context.Context, repo string) (string, error) {
	return a.mint(ctx, repo, false)
}

// WriteToken returns a token that may write to the repo "owner/name" (and
// only to it).
func (a *GitHubApp) WriteToken(ctx context.Context, repo string) (string, error) {
	return a.mint(ctx, repo, true)
}

func (a *GitHubApp) mint(ctx context.Context, repo string, write bool) (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	id, ok := a.installs[repo]
	if !ok {
		var inst struct {
			ID int64 `json:"id"`
		}
		if err := a.appRequest(ctx, http.MethodGet, "/repos/"+repo+"/installation", nil, &inst); err != nil {
			return "", fmt.Errorf("find the App installation of %s: %w", repo, err)
		}
		id = inst.ID
		a.installs[repo] = id
	}
	key, req := tokenKey{install: id}, map[string]any{"permissions": ReadPermissions}
	if write {
		_, name, _ := strings.Cut(repo, "/")
		key.repo, req = repo, map[string]any{"permissions": WritePermissions, "repositories": []string{name}}
	}
	if t, ok := a.tokens[key]; ok && a.now().Before(t.expires.Add(-5*time.Minute)) {
		return t.value, nil
	}
	body, _ := json.Marshal(req)
	var tok struct {
		Token     string    `json:"token"`
		ExpiresAt time.Time `json:"expires_at"`
	}
	path := "/app/installations/" + strconv.FormatInt(id, 10) + "/access_tokens"
	if err := a.appRequest(ctx, http.MethodPost, path, body, &tok); err != nil {
		if platform.IsStatus(err, 404) {
			delete(a.installs, repo) // uninstalled: look it up again next time
		}
		if write && platform.IsStatus(err, 422) {
			return "", fmt.Errorf("mint a write token for %s (does the App have Contents and Actions: read and write?): %w", repo, err)
		}
		return "", fmt.Errorf("mint an installation token for %s: %w", repo, err)
	}
	a.tokens[key] = token{value: tok.Token, expires: tok.ExpiresAt}
	return tok.Token, nil
}

func (a *GitHubApp) appRequest(ctx context.Context, method, path string, body []byte, out any) error {
	jwt, err := a.jwt()
	if err != nil {
		return err
	}
	h := http.Header{}
	h.Set("Authorization", "Bearer "+jwt)
	h.Set("Accept", "application/vnd.github+json")
	h.Set("X-GitHub-Api-Version", "2022-11-28")
	r := platform.Request{Method: method, URL: a.cfg.APIURL + path, Header: h}
	if body != nil {
		r.Body = bytes.NewReader(body)
		h.Set("Content-Type", "application/json")
	}
	return a.client.JSON(ctx, r, out)
}

// jwt is the App's RS256 JSON Web Token, valid for nine minutes (GitHub allows
// ten) and backdated a minute for clock drift.
func (a *GitHubApp) jwt() (string, error) {
	now := a.now()
	enc := base64.RawURLEncoding
	header := enc.EncodeToString([]byte(`{"alg":"RS256","typ":"JWT"}`))
	claims, _ := json.Marshal(map[string]any{
		"iat": now.Add(-time.Minute).Unix(), "exp": now.Add(9 * time.Minute).Unix(),
		"iss": strconv.FormatInt(a.cfg.AppID, 10),
	})
	signing := header + "." + enc.EncodeToString(claims)
	sum := sha256.Sum256([]byte(signing))
	sig, err := rsa.SignPKCS1v15(rand.Reader, a.key, crypto.SHA256, sum[:])
	if err != nil {
		return "", err
	}
	return signing + "." + enc.EncodeToString(sig), nil
}
