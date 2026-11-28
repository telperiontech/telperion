package oci

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
)

func TestVersionsWithTokenPaginationAndPlatforms(t *testing.T) {
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/token" {
			if r.URL.Query().Get("scope") != "repository:acme/gate:pull" {
				http.Error(w, "scope", http.StatusBadRequest)
				return
			}
			_, _ = w.Write([]byte(`{"token": "t1"}`))
			return
		}
		if r.Header.Get("Authorization") != "Bearer t1" {
			w.Header().Set("WWW-Authenticate", `Bearer realm="`+srv.URL+`/token",service="test",scope="repository:acme/gate:pull"`)
			http.Error(w, "auth", http.StatusUnauthorized)
			return
		}
		switch {
		case r.URL.Path == "/v2/acme/gate/tags/list" && r.URL.Query().Get("last") == "":
			w.Header().Set("Link", `</v2/acme/gate/tags/list?n=1000&last=1.0.0>; rel="next"`)
			_, _ = w.Write([]byte(`{"tags": ["latest", "1.0.0"]}`))
		case r.URL.Path == "/v2/acme/gate/tags/list":
			_, _ = w.Write([]byte(`{"tags": ["v1.1.0", "sha-abc"]}`))
		case r.URL.Path == "/v2/acme/gate/manifests/v1.1.0":
			_, _ = w.Write([]byte(`{"manifests": [{"platform": {"os": "linux", "architecture": "amd64"}},
				{"platform": {"os": "unknown", "architecture": "unknown"}}]}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	pkg := catalog.Package{Name: "gate", Artifact: &catalog.Artifact{OCI: &catalog.OCI{
		Registry: strings.TrimPrefix(srv.URL, "http://"), Name: "acme/gate", Insecure: true,
		Platforms: []string{"linux/amd64", "linux/arm64"},
	}}}
	a := &Artifact{Client: platform.New("t", 5*time.Second)}
	obs, err := a.Versions(context.Background(), pkg)
	if err != nil {
		t.Fatal(err)
	}
	if len(obs) != 2 {
		t.Fatalf("obs = %+v", obs)
	}
	if o := obs[0]; o.Version != "1.0.0" || o.State != model.OK {
		t.Errorf("1.0.0 = %+v", o)
	}
	if o := obs[1]; o.Version != "1.1.0" || o.State != model.Failed || o.Detail != "missing linux/arm64" {
		t.Errorf("1.1.0 = %+v (only amd64 in the index)", o)
	}
}
