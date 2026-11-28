package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/plan"
)

func TestRecipesAndPlans(t *testing.T) {
	srv, st, _ := newServer(t)
	call := func(method, path, body string) (int, []byte) {
		req, _ := http.NewRequest(method, srv.URL+path, strings.NewReader(body))
		req.SetBasicAuth("admin", "a long admin password")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		b, _ := io.ReadAll(resp.Body)
		return resp.StatusCode, b
	}
	const steps = `{"steps": [{"key": "calm", "type": "release", "package": "calm", "version": "2.0.0"}]}`

	if code, b := call(http.MethodPut, "/api/recipes/calm-only", `{"steps": [{"key": "x", "type": "release", "package": "nope", "bump": "patch"}]}`); code != http.StatusUnprocessableEntity ||
		!strings.Contains(string(b), `unknown package \"nope\"`) {
		t.Errorf("an invalid recipe = %d %s", code, b)
	}
	if code, b := call(http.MethodPut, "/api/recipes/calm-only", steps); code != http.StatusOK {
		t.Fatalf("save = %d %s", code, b)
	}
	code, b := call(http.MethodGet, "/api/recipes", "")
	var recipes []model.Plan
	if err := json.Unmarshal(b, &recipes); err != nil || code != http.StatusOK || len(recipes) != 1 || recipes[0].Name != "calm-only" || recipes[0].Managed {
		t.Fatalf("list = %d %s", code, b)
	}

	code, b = call(http.MethodPost, "/api/actions/preview", `{"recipe": "calm-only"}`)
	var p plan.Preview
	if err := json.Unmarshal(b, &p); err != nil || code != http.StatusOK || len(p.Errors) != 0 || p.Title != "calm-only" || len(p.Steps) != 1 {
		t.Fatalf("preview of a recipe = %d %s", code, b)
	}
	code, b = call(http.MethodPost, "/api/actions", fmt.Sprintf(`{"plan": %s, "confirm": {"fingerprint": %q}}`, steps, p.Fingerprint))
	if code != http.StatusCreated {
		t.Fatalf("start of an ad-hoc plan = %d %s", code, b)
	}
	var started struct{ Run int64 }
	_ = json.Unmarshal(b, &started)
	run, _ := st.Run(context.Background(), started.Run)
	if run.Plan == nil || run.Recipe != "" || run.Steps[0].State != model.StepReady {
		t.Errorf("run = %+v", run)
	}
	if code, _ := call(http.MethodPost, fmt.Sprintf("/api/runs/%d/resume", started.Run), ""); code != http.StatusNoContent {
		t.Errorf("resume = %d", code)
	}

	code, b = call(http.MethodPost, "/api/recipes/yaml", `{"name": "calm-only", "steps": [{"key": "calm", "type": "release", "package": "calm", "bump": "minor"}]}`)
	if code != http.StatusOK || !strings.Contains(string(b), `release: calm\n`) {
		t.Errorf("yaml = %d %s", code, b)
	}
	if code, _ := call(http.MethodDelete, "/api/recipes/calm-only", ""); code != http.StatusNoContent {
		t.Errorf("delete = %d", code)
	}
	if code, _ := call(http.MethodDelete, "/api/recipes/calm-only", ""); code != http.StatusNotFound {
		t.Errorf("delete again = %d", code)
	}
}
