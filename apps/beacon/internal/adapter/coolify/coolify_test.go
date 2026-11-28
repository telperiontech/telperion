package coolify

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
)

func TestRunning(t *testing.T) {
	t.Setenv("COOLIFY_TEST_TOKEN", "c-token")
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/applications/app-1" || r.Header.Get("Authorization") != "Bearer c-token" {
			http.Error(w, "no", http.StatusUnauthorized)
			return
		}
		_, _ = w.Write([]byte(`{"status": "running:healthy", "docker_registry_image_tag": "1.4.0"}`))
	}))
	defer srv.Close()
	target := catalog.Target{Name: "main", Coolify: &catalog.Coolify{URL: srv.URL, Token: catalog.SecretRef{Env: "COOLIFY_TEST_TOKEN"}}}
	rt := Runtime{Client: platform.New("t", 5*time.Second), Targets: func(string) (catalog.Target, bool) { return target, true }}
	o, err := rt.Running(context.Background(), "gate", catalog.Deploy{Target: "main", Coolify: &catalog.CoolifyApp{App: "app-1"}})
	if err != nil || o.Version != "1.4.0" || o.State != model.OK || !o.Exclusive || o.Target != "main" {
		t.Fatalf("obs = %+v %v", o, err)
	}
}
