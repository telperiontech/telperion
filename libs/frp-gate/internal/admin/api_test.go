package admin

import (
	"net/http"
	"strings"
	"testing"
)

func TestAPIFlow(t *testing.T) {
	srv := newTestServer(t)
	steps := []struct {
		method, path, body string
		want               int
	}{
		{"POST", "/api/v1/zones", `{"domain":"dev.example.com"}`, 201},
		{"POST", "/api/v1/zones", `{"domain":"dev.example.com"}`, 409},
		{"POST", "/api/v1/instances", `{"name":"main","server_addr":"gw.example.com:7000","zones":["dev.example.com"]}`, 201},
		{"POST", "/api/v1/groups", `{"name":"webapp"}`, 201},
		{"POST", "/api/v1/grants", `{"group":"webapp","kind":"host","zone":"dev.example.com","pattern":"*.{client}"}`, 201},
		{"POST", "/api/v1/grants", `{"group":"webapp","kind":"host","zone":"nope.example.com","pattern":"x"}`, 400},
		{"POST", "/api/v1/clients", `{"name":"alice","groups":["webapp"]}`, 201},
		{"POST", "/api/v1/clients", `{"name":"bad name"}`, 400},
		{"POST", "/api/v1/clients", `{"name":"x","unknown":1}`, 400},
		{"POST", "/api/v1/clients/alice/disable", ``, 200},
		{"POST", "/api/v1/clients/nobody/disable", ``, 404},
		{"PUT", "/api/v1/groups/webapp/members/alice", ``, 200},
		{"DELETE", "/api/v1/zones/dev.example.com", ``, 400},
		{"GET", "/api/v1/status", ``, 200},
		{"GET", "/api/v1/nothing", ``, 404},
	}
	for _, s := range steps {
		code, out := api(t, srv, s.method, s.path, s.body)
		if code != s.want {
			t.Errorf("%s %s: %d %v, want %d", s.method, s.path, code, out, s.want)
		}
	}
	code, out := api(t, srv, "GET", "/api/v1/clients/alice", "")
	if code != 200 || !strings.Contains(out["frpc_toml"].(string), `customDomains = ["app.alice.dev.example.com"]`) ||
		!strings.Contains(out["frpc_toml"].(string), `serverAddr = "gw.example.com"`) {
		t.Errorf("client detail: %d %v", code, out)
	}
}

func TestAPIRequiresAuth(t *testing.T) {
	srv := newTestServer(t)
	resp, err := http.Get(srv.URL + "/api/v1/clients")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("got %d", resp.StatusCode)
	}
	req, _ := http.NewRequest("GET", srv.URL+"/api/v1/clients", nil)
	req.SetBasicAuth("admin", "wrong")
	resp, _ = http.DefaultClient.Do(req)
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("wrong password: %d", resp.StatusCode)
	}
}
