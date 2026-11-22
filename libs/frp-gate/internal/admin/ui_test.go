package admin

import (
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"testing"
)

// TestUIFlow logs in, creates data through the forms and renders every page,
// which catches template errors that only show at run time.
func TestUIFlow(t *testing.T) {
	srv := newTestServer(t)
	jar, _ := cookiejar.New(nil)
	c := &http.Client{Jar: jar}
	do := func(method, path string, form url.Values) (int, string) {
		t.Helper()
		var resp *http.Response
		var err error
		if method == "GET" {
			resp, err = c.Get(srv.URL + path)
		} else {
			resp, err = c.PostForm(srv.URL+path, form)
		}
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		b, _ := io.ReadAll(resp.Body)
		return resp.StatusCode, string(b)
	}
	if code, body := do("POST", "/login", url.Values{"password": {"nope"}}); code != 401 || !strings.Contains(body, "Wrong password") {
		t.Fatalf("bad login: %d", code)
	}
	if code, body := do("POST", "/login", url.Values{"password": {testPassword}}); code != 200 || !strings.Contains(body, "Connected now") {
		t.Fatalf("login: %d %s", code, body)
	}
	steps := []struct {
		path string
		form url.Values
		want string
	}{
		{"/zones", url.Values{"domain": {"dev.example.com"}}, "Zone dev.example.com added"},
		{"/instances", url.Values{"name": {"main"}, "server_addr": {"gw.example.com:7000"}, "zones": {"dev.example.com"}}, "[[httpPlugins]]"},
		{"/groups", url.Values{"name": {"videochat"}}, "Group videochat created"},
		{"/grants", url.Values{"kind": {"host"}, "subject": {"group:videochat"}, "zone": {"dev.example.com"}, "pattern": {"*.{client}"}}, "*.{client}.dev.example.com"},
		{"/grants", url.Values{"kind": {"port"}, "subject": {"group:videochat"}, "instance": {"main"}, "proto": {"tcp"}, "ports": {"6000-6010"}}, "tcp 6000-6010 on main"},
		{"/clients", url.Values{"name": {"sahin"}, "groups": {"videochat"}}, "fg_"},
		{"/groups/videochat/members", url.Values{"client": {"sahin"}}, "Member added"},
		{"/clients/sahin/disable", nil, "disabled"},
		{"/clients/sahin/rotate", nil, "New token issued"},
		{"/instances/main/zones", url.Values{"zones": {"dev.example.com"}}, "Zones of main saved"},
		{"/zones/dev.example.com/delete", nil, "still has grants"},
		{"/grants", url.Values{"kind": {"host"}, "subject": {"group:videochat"}, "zone": {"dev.example.com"}, "pattern": {"a.*"}}, "only allowed as the leftmost"},
	}
	for _, s := range steps {
		code, body := do("POST", s.path, s.form)
		if code != 200 || !strings.Contains(body, s.want) {
			t.Errorf("POST %s: %d, body lacks %q", s.path, code, s.want)
		}
	}
	for _, p := range []string{"/status", "/clients", "/clients/sahin", "/zones", "/groups", "/grants", "/instances", "/audit"} {
		if code, body := do("GET", p, nil); code != 200 || !strings.Contains(body, "</html>") {
			t.Errorf("GET %s: %d", p, code)
		}
	}
	// A cross-site form post is refused.
	req, _ := http.NewRequest("POST", srv.URL+"/clients/sahin/delete", nil)
	req.Header.Set("Sec-Fetch-Site", "cross-site")
	resp, err := c.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("cross-site post: %d", resp.StatusCode)
	}
}
