package githubrelease

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/githubapi"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
)

type tokens struct{}

func (tokens) Token(context.Context, string) (string, error)      { return "read", nil }
func (tokens) WriteToken(context.Context, string) (string, error) { return "write", nil }

func TestFire(t *testing.T) {
	var created map[string]any
	existing := map[string]bool{"/repos/acme/libs/git/ref/tags/js-utils-v1.0.0": true}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && strings.Contains(r.URL.Path, "/git/ref/"):
			if !existing[r.URL.Path] {
				http.NotFound(w, r)
				return
			}
			_, _ = w.Write([]byte(`{}`))
		case r.Method == http.MethodPost && r.URL.Path == "/repos/acme/libs/releases":
			if r.Header.Get("Authorization") != "Bearer write" {
				http.Error(w, "read token used for a write", http.StatusForbidden)
				return
			}
			_ = json.NewDecoder(r.Body).Decode(&created)
			_, _ = w.Write([]byte(`{"html_url": "https://github.example.com/acme/libs/releases/tag/js-utils-v1.1.0"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	trig := Trigger{API: githubapi.API{Client: platform.New("t", 5*time.Second), URL: srv.URL, Tokens: tokens{}}}
	pkg := catalog.Package{Name: "js-utils", Repo: catalog.Repo{GitHub: "acme/libs"},
		Release: &catalog.Release{GitHubRelease: &catalog.GitHubRelease{Notes: catalog.NotesGenerate}}}
	req := adapter.ReleaseRequest{Package: pkg, Version: "1.1.0", Tag: "js-utils-v1.1.0", Branch: "main", Commit: "abcdef0123"}

	if d := trig.Describe(req); d != "create the GitHub release js-utils-v1.1.0 at abcdef0 on main, with generated release notes" {
		t.Errorf("Describe = %q", d)
	}
	fired, err := trig.Fire(context.Background(), req)
	if err != nil || !strings.HasSuffix(fired.URL, "/js-utils-v1.1.0") {
		t.Fatalf("fired = %+v %v", fired, err)
	}
	if created["tag_name"] != "js-utils-v1.1.0" || created["target_commitish"] != "abcdef0123" || created["generate_release_notes"] != true {
		t.Errorf("release request = %v", created)
	}

	created = nil
	req.Version, req.Tag = "1.0.0", "js-utils-v1.0.0"
	fired, err = trig.Fire(context.Background(), req)
	if err != nil || created != nil || !strings.HasPrefix(fired.Detail, "adopted") {
		t.Errorf("an existing tag was not adopted: %+v %v %v", fired, err, created)
	}
}
