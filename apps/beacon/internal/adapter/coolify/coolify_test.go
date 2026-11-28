package coolify

import (
	"context"
	"encoding/json"
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

func TestDeploy(t *testing.T) {
	t.Setenv("COOLIFY_TEST_TOKEN", "c-token")
	tag := "1.4.0"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method + " " + r.URL.Path {
		case "GET /api/v1/applications/app-1":
			_, _ = w.Write([]byte(`{"status": "running:healthy", "docker_registry_image_tag": "` + tag + `"}`))
		case "PATCH /api/v1/applications/app-1":
			var body map[string]string
			_ = json.NewDecoder(r.Body).Decode(&body)
			tag = body["docker_registry_image_tag"]
			_, _ = w.Write([]byte(`{"uuid": "app-1"}`))
		case "GET /api/v1/deploy":
			if r.URL.Query().Get("uuid") != "app-1" {
				http.Error(w, "no uuid", http.StatusBadRequest)
				return
			}
			_, _ = w.Write([]byte(`{"deployments": [{"deployment_uuid": "dep-9"}]}`))
		case "GET /api/v1/deployments/dep-9":
			_, _ = w.Write([]byte(`{"status": "in_progress"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	target := catalog.Target{Name: "main", Coolify: &catalog.Coolify{URL: srv.URL, Token: catalog.SecretRef{Env: "COOLIFY_TEST_TOKEN"}}}
	rt := Runtime{Client: platform.New("t", 5*time.Second), Targets: func(string) (catalog.Target, bool) { return target, true }}
	d := catalog.Deploy{Target: "main", Coolify: &catalog.CoolifyApp{App: "app-1"}}
	ctx := context.Background()

	if ref, err := rt.Deploy(ctx, "gate", d, "1.4.0"); err != nil || ref.ID != "" {
		t.Errorf("deploying the running version = %+v %v, want adopted", ref, err)
	}
	ref, err := rt.Deploy(ctx, "gate", d, "1.5.0")
	if err != nil || ref.ID != "dep-9" || tag != "1.5.0" {
		t.Fatalf("deploy = %+v %v (tag %s)", ref, err, tag)
	}
	if st, detail, err := rt.DeployStatus(ctx, d, ref); err != nil || st != model.Pending || detail != "in_progress" {
		t.Errorf("status = %s %s %v", st, detail, err)
	}
}
