package admin

import (
	"context"
	"strings"
	"testing"
)

// TestAPIManagedObjects: managed objects are refused with 409 and a clear
// message; disabling a managed client still works; actions are audited.
func TestAPIManagedObjects(t *testing.T) {
	srv, st := newTestServerStore(t)
	for _, s := range []struct{ method, path, body string }{
		{"POST", "/api/v1/zones", `{"domain":"dev.example.com"}`},
		{"POST", "/api/v1/instances", `{"name":"main","zones":["dev.example.com"]}`},
		{"POST", "/api/v1/clients", `{"name":"pi"}`},
		{"POST", "/api/v1/grants", `{"client":"pi","kind":"host","zone":"dev.example.com","pattern":"pi"}`},
	} {
		if code, out := api(t, srv, s.method, s.path, s.body); code != 201 {
			t.Fatalf("%s %s: %d %v", s.method, s.path, code, out)
		}
	}
	ctx := context.Background()
	c, _ := st.ClientByName(ctx, "pi")
	z, _ := st.ZoneByDomain(ctx, "dev.example.com")
	in, _ := st.InstanceByName(ctx, "main")
	gs, _ := st.ListGrants(ctx)
	for table, id := range map[string]int64{"clients": c.ID, "zones": z.ID, "instances": in.ID, "grants": gs[0].ID} {
		if err := st.SetManaged(ctx, table, id, true); err != nil {
			t.Fatal(err)
		}
	}
	if err := st.SetSecretManaged(ctx, "clients", c.ID, true); err != nil {
		t.Fatal(err)
	}

	for _, s := range []struct{ method, path, body string }{
		{"DELETE", "/api/v1/clients/pi", ""},
		{"POST", "/api/v1/clients/pi/rotate", ""},
		{"DELETE", "/api/v1/zones/dev.example.com", ""},
		{"PUT", "/api/v1/instances/main/zones", `{"zones":[]}`},
		{"DELETE", "/api/v1/instances/main", ""},
		{"DELETE", "/api/v1/grants/" + itoa(gs[0].ID), ""},
	} {
		code, out := api(t, srv, s.method, s.path, s.body)
		if code != 409 || !strings.Contains(out["error"].(string), "managed by the config file") {
			t.Errorf("%s %s: %d %v, want 409", s.method, s.path, code, out)
		}
	}
	if code, out := api(t, srv, "POST", "/api/v1/clients/pi/disable", ""); code != 200 {
		t.Errorf("disable managed client: %d %v", code, out)
	}

	code, out := api(t, srv, "GET", "/api/v1/audit", "")
	entries, _ := out["entries"].([]any)
	if code != 200 || len(entries) < 5 {
		t.Fatalf("audit: %d %v", code, out)
	}
	newest := entries[0].(map[string]any)
	if newest["action"] != "client.disable" || newest["source"] != "api" || newest["object"] != "pi" {
		t.Errorf("newest audit entry: %v", newest)
	}
}
