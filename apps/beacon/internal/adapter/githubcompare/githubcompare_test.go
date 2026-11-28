package githubcompare

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/adapter/githubapi"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
)

func TestUnreleased(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/repos/acme/libs/compare/js-utils-v1.0.0...main":
			if r.Header.Get("If-None-Match") == `"c1"` {
				w.WriteHeader(http.StatusNotModified)
				return
			}
			w.Header().Set("ETag", `"c1"`)
			_, _ = w.Write([]byte(`{"ahead_by": 3, "commits": [{"sha": "a"}, {"sha": "b"}, {"sha": "c"}]}`))
		case "/repos/acme/libs/commits":
			if r.URL.Query().Get("path") != "libs/js-utils" || r.URL.Query().Get("sha") != "main" {
				http.Error(w, "bad query", http.StatusBadRequest)
				return
			}
			// b touches the path; z does too but is older than the tag.
			_, _ = w.Write([]byte(`[{"sha": "b"}, {"sha": "z"}]`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	c := Changes{API: githubapi.API{Client: platform.New("t", 5*time.Second), URL: srv.URL, Tokens: adapter.Anonymous{}}, WebURL: "https://github.example.com"}
	pkg := catalog.Package{Name: "js-utils", Repo: catalog.Repo{GitHub: "acme/libs"}, Path: "libs/js-utils"}

	u, err := c.Unreleased(context.Background(), pkg, "js-utils-v1.0.0", "main")
	if err != nil || u.Commits != 1 || u.URL != "https://github.example.com/acme/libs/compare/js-utils-v1.0.0...main" {
		t.Fatalf("unreleased = %+v %v", u, err)
	}
	if _, err := c.Unreleased(context.Background(), pkg, "js-utils-v1.0.0", "main"); !errors.Is(err, platform.ErrNotModified) {
		t.Errorf("an unchanged compare = %v, want not modified", err)
	}
	pkg.Path = ""
	pkg.Name = "whole-repo" // own ETag key
	if u, _ := c.Unreleased(context.Background(), pkg, "js-utils-v1.0.0", "main"); u.Commits != 3 {
		t.Errorf("without a path = %d commits, want ahead_by 3", u.Commits)
	}
}
