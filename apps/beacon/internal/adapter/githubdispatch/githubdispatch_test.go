package githubdispatch

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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

func TestFire(t *testing.T) {
	var body struct {
		Ref    string            `json:"ref"`
		Inputs map[string]string `json:"inputs"`
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet:
			http.NotFound(w, r) // the tag does not exist yet
		case r.URL.Path == "/repos/acme/app/actions/workflows/release.yml/dispatches" && r.Header.Get("Authorization") == "Bearer write":
			_ = json.NewDecoder(r.Body).Decode(&body)
			w.WriteHeader(http.StatusNoContent)
		default:
			http.Error(w, "unexpected", http.StatusBadRequest)
		}
	}))
	defer srv.Close()
	pkg := catalog.Package{Name: "app", Repo: catalog.Repo{GitHub: "acme/app"}, Release: &catalog.Release{
		GitHubDispatch: &catalog.GitHubDispatch{Workflow: "release.yml", Inputs: map[string]string{"what": "{package}@{version}", "bump": "{bump}"}},
	}}
	req := adapter.ReleaseRequest{Package: pkg, Version: "2.0.0", Tag: "app-v2.0.0", Bump: "major", Branch: "main"}
	trig := Trigger{API: githubapi.API{Client: platform.New("t", 5*time.Second), URL: srv.URL, Tokens: tokens{}}}
	if _, err := trig.Fire(context.Background(), req); err != nil {
		t.Fatal(err)
	}
	if body.Ref != "main" || body.Inputs["what"] != "app@2.0.0" || body.Inputs["bump"] != "major" {
		t.Errorf("dispatch = %+v", body)
	}
	if d := trig.Describe(req); d != "dispatch release.yml on main with bump=major, what=app@2.0.0" {
		t.Errorf("Describe = %q", d)
	}
}
