package api

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/observe"
	"github.com/telperiontech/telperion/apps/beacon/internal/plan"
	"github.com/telperiontech/telperion/apps/beacon/internal/store"
	"github.com/telperiontech/telperion/libs/go-kit/session"
)

func newServer(t *testing.T) (*httptest.Server, *store.Store, *observe.Broker) {
	t.Helper()
	ctx := context.Background()
	st, err := store.Open(ctx, ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	c := catalog.Catalog{
		Projects: []catalog.Project{{Name: "p", Repo: catalog.Repo{GitHub: "acme/p", URL: "https://github.com/acme/p.git"}}},
		Packages: []catalog.Package{
			{Name: "calm", Project: "p", Tag: catalog.DefaultTag, Repo: catalog.Repo{GitHub: "acme/p", URL: "https://github.com/acme/p.git"},
				Release: &catalog.Release{GitHubRelease: &catalog.GitHubRelease{Notes: catalog.NotesGenerate}}},
			{Name: "stuck", Project: "p", Tag: catalog.DefaultTag, Repo: catalog.Repo{GitHub: "acme/p", URL: "https://github.com/acme/p.git"},
				CI: &catalog.CI{GitHubActions: &catalog.GitHubActions{Workflow: "stuck.publish.yml"}}},
		},
	}
	if err := st.WithTx(ctx, func(tx *store.Store) error { return tx.SaveCatalog(ctx, c) }); err != nil {
		t.Fatal(err)
	}
	old := time.Now().Add(-2 * time.Hour)
	if _, err := st.Observe(ctx, []model.Obs{
		{Package: "stuck", Version: "1.0.0", Stage: model.Tagged, State: model.OK, At: old},
		{Package: "calm", Version: "2.0.0", Stage: model.Tagged, State: model.OK},
	}); err != nil {
		t.Fatal(err)
	}
	broker := &observe.Broker{}
	auth := &session.Auth{Password: "a long admin password", Key: []byte("k"), Cookie: "beacon_session", AllowBasic: true, Sleep: func(time.Duration) {}}
	h := New(Options{
		Views: Views{Store: st, Now: time.Now}, Store: st, Auth: auth, Broker: broker,
		Status: func() []observe.JobStatus { return nil },
		UI:     http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("ui")) }),
		Log:    slog.New(slog.NewTextHandler(io.Discard, nil)),
		Plans:  plan.Env{Store: st, Platform: func(catalog.Catalog) (plan.Platform, error) { return fakePlatform{}, nil }},
		Runner: fakeRunner{st},
	})
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	return srv, st, broker
}

func client(t *testing.T) *http.Client {
	jar, _ := cookiejar.New(nil)
	return &http.Client{Jar: jar, Timeout: 5 * time.Second}
}

func TestLoginAndOverview(t *testing.T) {
	srv, st, _ := newServer(t)
	c := client(t)

	if resp, _ := c.Get(srv.URL + "/api/overview"); resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("anonymous overview = %d", resp.StatusCode)
	}
	resp, _ := c.Post(srv.URL+"/api/login", "application/json", strings.NewReader(`{"password": "wrong"}`))
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("wrong password = %d", resp.StatusCode)
	}
	resp, _ = c.Post(srv.URL+"/api/login", "application/json", strings.NewReader(`{"password": "a long admin password"}`))
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("login = %d", resp.StatusCode)
	}

	resp, err := c.Get(srv.URL + "/api/overview")
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("overview = %v %v", resp, err)
	}
	var o Overview
	_ = json.NewDecoder(resp.Body).Decode(&o)
	if len(o.Packages) != 2 || o.Packages[0].Name != "stuck" || len(o.Packages[0].Gaps) != 1 || !o.Packages[0].Gaps[0].Stuck {
		t.Errorf("overview = %+v (the stuck package first)", o.Packages)
	}
	if o.Packages[0].Links.CI != "https://github.com/acme/p/actions/workflows/stuck.publish.yml" {
		t.Errorf("links = %+v", o.Packages[0].Links)
	}

	if entries, _ := st.ListAudit(context.Background(), 0, 10); len(entries) != 2 || entries[0].Action != "session.login" {
		t.Errorf("audit = %+v", entries)
	}
	if resp, _ := c.Get(srv.URL + "/api/packages/nope"); resp.StatusCode != http.StatusNotFound {
		t.Errorf("unknown package = %d", resp.StatusCode)
	}
}

func TestCrossOriginWriteRefused(t *testing.T) {
	srv, _, _ := newServer(t)
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/login", strings.NewReader(`{"password": "a long admin password"}`))
	req.Header.Set("Sec-Fetch-Site", "cross-site")
	resp, err := http.DefaultClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusForbidden {
		t.Fatalf("cross-site login = %v %v", resp.StatusCode, err)
	}
}

func TestStream(t *testing.T) {
	srv, _, broker := newServer(t)
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/events", nil)
	req.SetBasicAuth("admin", "a long admin password")
	resp, err := http.DefaultClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK || resp.Header.Get("Content-Type") != "text/event-stream" {
		t.Fatalf("stream = %v %v", resp, err)
	}
	defer resp.Body.Close()
	r := bufio.NewReader(resp.Body)
	_, _ = r.ReadString('\n') // retry
	_, _ = r.ReadString('\n')

	go func() {
		time.Sleep(50 * time.Millisecond)
		broker.Publish(observe.PackagesNotice([]string{"b", "a", "b"}))
	}()
	line, err := r.ReadString('\n')
	if err != nil || strings.TrimSpace(line) != `data: {"packages":["a","b"]}` {
		t.Errorf("event = %q %v", line, err)
	}
}
