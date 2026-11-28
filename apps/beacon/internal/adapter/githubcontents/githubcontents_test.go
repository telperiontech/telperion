package githubcontents

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/githubapi"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
)

type tokens struct{}

func (tokens) Token(context.Context, string) (string, error)            { return "read", nil }
func (tokens) WriteToken(context.Context, string) (string, error)       { return "write", nil }
func (tokens) PullRequestToken(context.Context, string) (string, error) { return "pr", nil }

// fakeGitHub keeps one file per branch, branches and pull requests.
type fakeGitHub struct {
	mu       sync.Mutex
	files    map[string]string // branch → content
	branches map[string]string // branch → commit
	pulls    []map[string]any
	auth     []string
}

func (f *fakeGitHub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.auth = append(f.auth, r.Method+" "+r.URL.Path+" "+r.Header.Get("Authorization"))
	const repo = "/repos/acme/libs"
	switch {
	case r.Method == http.MethodGet && r.URL.Path == repo+"/contents/libs/ng-pack/package.json":
		content, ok := f.files[r.URL.Query().Get("ref")]
		if !ok {
			http.NotFound(w, r)
			return
		}
		writeJSON(w, map[string]string{"encoding": "base64", "sha": "blob-" + content,
			"content": base64.StdEncoding.EncodeToString([]byte(content))})
	case r.Method == http.MethodPut && r.URL.Path == repo+"/contents/libs/ng-pack/package.json":
		var body map[string]string
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body["sha"] != "blob-"+f.files[body["branch"]] {
			http.Error(w, "sha does not match", http.StatusConflict)
			return
		}
		b, _ := base64.StdEncoding.DecodeString(body["content"])
		f.files[body["branch"]] = string(b)
		writeJSON(w, map[string]any{"commit": map[string]string{"sha": "c-" + body["branch"], "html_url": "https://github.example.com/c"}})
	case r.Method == http.MethodGet && r.URL.Path == repo+"/git/ref/heads/beacon/run-1":
		if _, ok := f.branches["beacon/run-1"]; !ok {
			http.NotFound(w, r)
			return
		}
		writeJSON(w, map[string]any{})
	case r.Method == http.MethodPost && r.URL.Path == repo+"/git/refs":
		var body map[string]string
		_ = json.NewDecoder(r.Body).Decode(&body)
		f.branches["beacon/run-1"], f.files["beacon/run-1"] = body["sha"], f.files["main"]
		writeJSON(w, map[string]any{})
	case r.Method == http.MethodGet && r.URL.Path == repo+"/pulls":
		writeJSON(w, f.pulls)
	case r.Method == http.MethodPost && r.URL.Path == repo+"/pulls":
		pr := map[string]any{"number": 7, "html_url": "https://github.example.com/acme/libs/pull/7", "state": "open"}
		f.pulls = append(f.pulls, pr)
		writeJSON(w, pr)
	case r.Method == http.MethodGet && r.URL.Path == repo+"/pulls/7":
		writeJSON(w, map[string]any{"number": 7, "state": "closed", "merged": true, "merge_commit_sha": "m1"})
	default:
		http.NotFound(w, r)
	}
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

func TestCommitAndPullRequest(t *testing.T) {
	gh := &fakeGitHub{files: map[string]string{"main": `{"a":"^1.0.0"}`}, branches: map[string]string{}}
	srv := httptest.NewServer(gh)
	defer srv.Close()
	c := Committer{API: githubapi.API{Client: platform.New("t", 5*time.Second), URL: srv.URL, Tokens: tokens{}}}
	ctx, repo := context.Background(), catalog.Repo{GitHub: "acme/libs"}
	const path = "libs/ng-pack/package.json"

	f, err := c.ReadFile(ctx, repo, "main", path)
	if err != nil || string(f.Content) != `{"a":"^1.0.0"}` {
		t.Fatalf("read = %+v %v", f, err)
	}
	ch := adapter.FileChange{Repo: repo, Branch: "main", Base: "base1", Path: path, Content: []byte(`{"a":"^1.1.0"}`), Message: "m"}
	commit, _, err := c.Commit(ctx, ch, f.SHA)
	if err != nil || commit != "c-main" || gh.files["main"] != `{"a":"^1.1.0"}` {
		t.Fatalf("commit = %q %v, file %s", commit, err, gh.files["main"])
	}
	if _, _, err := c.Commit(ctx, ch, f.SHA); !platform.IsStatus(err, http.StatusConflict) {
		t.Errorf("a stale blob was overwritten: %v", err)
	}

	ch.Content = []byte(`{"a":"^1.2.0"}`)
	pr, err := c.OpenPR(ctx, ch, "beacon/run-1", "title", "body")
	if err != nil || pr.Number != 7 || pr.State != adapter.PROpen || gh.branches["beacon/run-1"] != "base1" ||
		gh.files["beacon/run-1"] != `{"a":"^1.2.0"}` || gh.files["main"] != `{"a":"^1.1.0"}` {
		t.Fatalf("pr = %+v %v, files %v", pr, err, gh.files)
	}
	if again, err := c.OpenPR(ctx, ch, "beacon/run-1", "title", "body"); err != nil || again.Number != 7 || len(gh.pulls) != 1 {
		t.Errorf("a second OpenPR did not reuse the pull request: %+v %v", again, err)
	}
	if st, err := c.PullRequest(ctx, repo, 7); err != nil || st.State != adapter.PRMerged || st.Merge != "m1" {
		t.Errorf("status = %+v %v", st, err)
	}
	for _, a := range gh.auth {
		if (a[:3] == "PUT" || a[:4] == "POST") && a[len(a)-4:] == "read" {
			t.Errorf("a write used the read token: %s", a)
		}
	}
}
