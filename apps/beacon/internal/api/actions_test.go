package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/plan"
	"github.com/telperiontech/telperion/apps/beacon/internal/store"
)

type fakePlatform struct{}

func (fakePlatform) Refs(context.Context, catalog.Repo) (adapter.Refs, error) {
	return adapter.Refs{Tags: []adapter.Tag{{Name: "calm-v2.0.0"}}, Heads: map[string]string{"main": "c0ffee"}, Default: "main"}, nil
}
func (fakePlatform) Trigger(p catalog.Package) (adapter.Trigger, bool) { return nil, p.Release != nil }
func (fakePlatform) Rerunner(catalog.Package) (adapter.Rerunner, bool) { return nil, false }
func (fakePlatform) Deployer(catalog.Package, string) (adapter.Deployer, catalog.Deploy, bool) {
	return nil, catalog.Deploy{}, false
}
func (fakePlatform) Committer(catalog.Package) (adapter.Committer, bool) { return nil, false }

// fakeRunner cancels by marking the run; the real runner is tested in plan.
type fakeRunner struct{ st *store.Store }

func (fakeRunner) Kick() {}
func (f fakeRunner) Cancel(ctx context.Context, id int64) error {
	if _, err := f.st.Run(ctx, id); err != nil {
		return err
	}
	return f.st.FinishRun(ctx, id, model.RunCancelled)
}

func (f fakeRunner) Resume(ctx context.Context, id int64) error {
	if _, err := f.st.Run(ctx, id); err != nil {
		return err
	}
	return f.st.ReopenRun(ctx, id)
}

func TestActions(t *testing.T) {
	srv, st, _ := newServer(t)
	post := func(path, body string) (*http.Response, map[string]json.RawMessage) {
		req, _ := http.NewRequest(http.MethodPost, srv.URL+path, strings.NewReader(body))
		req.SetBasicAuth("admin", "a long admin password")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		var out map[string]json.RawMessage
		_ = json.NewDecoder(resp.Body).Decode(&out)
		return resp, out
	}

	// stuck has no release trigger: the preview says so and cannot start.
	resp, out := post("/api/actions/preview", `{"kind": "release", "package": "stuck", "bump": "minor"}`)
	var p plan.Preview
	_ = json.Unmarshal(mustJSON(out), &p)
	if resp.StatusCode != http.StatusOK || len(p.Errors) != 1 || !strings.Contains(p.Errors[0], "no release trigger") {
		t.Fatalf("preview of a package without a trigger = %d %+v", resp.StatusCode, p)
	}

	resp, out = post("/api/actions", `{"kind": "release", "package": "calm", "version": "2.0.0", "confirm": {"fingerprint": "old"}}`)
	if resp.StatusCode != http.StatusConflict || out["preview"] == nil {
		t.Fatalf("a stale confirmation = %d %v", resp.StatusCode, out)
	}
	_ = json.Unmarshal(out["preview"], &p)
	if len(p.Steps) != 1 || !p.Steps[0].Adopted {
		t.Fatalf("preview = %+v (the existing tag is adopted)", p)
	}

	resp, out = post("/api/actions", fmt.Sprintf(`{"kind": "release", "package": "calm", "version": "2.0.0", "confirm": {"fingerprint": %q}}`, p.Fingerprint))
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("start = %d %v", resp.StatusCode, out)
	}
	var id int64
	_ = json.Unmarshal(out["run"], &id)
	run, err := st.Run(context.Background(), id)
	if err != nil || run.Source != "api" || run.Steps[0].Version != "2.0.0" {
		t.Fatalf("run = %+v %v", run, err)
	}
	if resp, _ := post(fmt.Sprintf("/api/runs/%d/cancel", id), ``); resp.StatusCode != http.StatusNoContent {
		t.Errorf("cancel = %d", resp.StatusCode)
	}
	if resp, _ := post("/api/runs/999/cancel", ``); resp.StatusCode != http.StatusNotFound {
		t.Errorf("cancel of an unknown run = %d", resp.StatusCode)
	}
	if entries, _ := st.ListAudit(context.Background(), 0, 10); len(entries) == 0 || entries[0].Action != "plan.start" || entries[0].Source != "api" {
		t.Errorf("audit = %+v", entries)
	}
}

func mustJSON(m map[string]json.RawMessage) []byte {
	b, _ := json.Marshal(m)
	return b
}
