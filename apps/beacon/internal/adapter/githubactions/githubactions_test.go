package githubactions

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/githubapi"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
)

const runs = `{"workflow_runs": [
  {"id": 3, "head_branch": "js-utils-v1.2.0", "status": "in_progress", "html_url": "https://ci/3", "created_at": "2026-01-01T10:00:00Z", "updated_at": "2026-01-01T10:01:00Z"},
  {"id": 2, "head_branch": "js-utils-v1.1.0", "status": "completed", "conclusion": "failure", "html_url": "https://ci/2", "created_at": "2026-01-01T09:00:00Z", "updated_at": "2026-01-01T09:05:00Z"},
  {"id": 1, "head_branch": "js-utils-v1.1.0", "status": "completed", "conclusion": "success", "html_url": "https://ci/1", "created_at": "2026-01-01T08:00:00Z", "updated_at": "2026-01-01T08:05:00Z"},
  {"id": 0, "head_branch": "main", "status": "completed", "conclusion": "success", "created_at": "2026-01-01T07:00:00Z", "updated_at": "2026-01-01T07:05:00Z"}
]}`

func TestRuns(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/acme/libs/actions/workflows/js-utils.publish.yml/runs" || r.URL.Query().Get("event") != "push" {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write([]byte(runs))
	}))
	defer srv.Close()
	pkg := catalog.Package{
		Name: "js-utils", Repo: catalog.Repo{GitHub: "acme/libs"},
		CI: &catalog.CI{GitHubActions: &catalog.GitHubActions{Workflow: "js-utils.publish.yml"}},
	}
	m, _ := catalog.NewTagMatcher(catalog.DefaultTag, "js-utils")
	obs, err := CI{API: githubapi.API{Client: platform.New("t", 5*time.Second), URL: srv.URL, Tokens: adapter.Anonymous{}}}.Runs(context.Background(), pkg, m)
	if err != nil {
		t.Fatal(err)
	}
	if len(obs) != 2 {
		t.Fatalf("obs = %+v", obs)
	}
	if o := obs[0]; o.Version != "1.2.0" || o.State != model.Pending || !o.At.Equal(time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)) {
		t.Errorf("1.2.0 = %+v", o)
	}
	if o := obs[1]; o.Version != "1.1.0" || o.State != model.Failed || o.URL != "https://ci/2" {
		t.Errorf("1.1.0 = %+v (the newest run wins)", o)
	}
}
