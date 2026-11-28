package npm

import (
	"context"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
)

const packument = `{
  "_id": "@telperion/js-utils",
  "name": "@telperion/js-utils",
  "dist-tags": {"latest": "1.1.0"},
  "versions": {
    "1.0.0": {"name": "@telperion/js-utils", "dependencies": {"a": "^1"}, "scripts": {"x": "[{}]"}},
    "1.1.0": {"name": "@telperion/js-utils", "nested": [[{"deep": [1, 2, {"k": null}]}]]}
  },
  "time": {"created": "2025-01-01T00:00:00.000Z", "1.0.0": "2025-01-02T00:00:00.000Z",
           "1.1.0": "2025-02-01T00:00:00.000Z", "0.9.0": "2024-12-01T00:00:00.000Z"},
  "readme": "# a long readme {with braces}"
}`

func TestDecode(t *testing.T) {
	versions, times, err := Decode(strings.NewReader(packument))
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(versions, []string{"1.0.0", "1.1.0"}) {
		t.Errorf("versions = %v (0.9.0 was unpublished)", versions)
	}
	if !times["1.1.0"].Equal(time.Date(2025, 2, 1, 0, 0, 0, 0, time.UTC)) {
		t.Errorf("times = %v", times)
	}
}

func TestVersions(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.EscapedPath() != "/@telperion%2Fjs-utils" {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write([]byte(packument))
	}))
	defer srv.Close()
	pkg := catalog.Package{Name: "js-utils", Artifact: &catalog.Artifact{NPM: &catalog.NPM{Name: "@telperion/js-utils", Registry: srv.URL}}}
	obs, err := Artifact{Client: platform.New("t", 5*time.Second)}.Versions(context.Background(), pkg)
	if err != nil || len(obs) != 2 || obs[0].Stage != model.Published || obs[0].State != model.OK {
		t.Fatalf("obs = %+v %v", obs, err)
	}
}
