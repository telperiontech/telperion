package ingest

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/observe"
	"github.com/telperiontech/telperion/apps/beacon/internal/secret"
	"github.com/telperiontech/telperion/apps/beacon/internal/store"
)

func testCatalog() catalog.Catalog {
	repo := catalog.Repo{GitHub: "acme/libs", URL: "https://github.example.com/acme/libs.git"}
	return catalog.Catalog{
		GitHub: &catalog.GitHubApp{AppID: 1, WebURL: "https://github.example.com", APIURL: "https://api.github.example.com",
			WebhookSecret: catalog.SecretRef{Env: "INGEST_TEST_HOOK"}},
		CDEvents: []catalog.CDEventsSource{
			{Name: "ci", Token: catalog.SecretRef{Env: "INGEST_TEST_CI"}},
			{Name: "narrow", Token: catalog.SecretRef{Env: "INGEST_TEST_NARROW"}, Packages: []string{"site"}},
		},
		Projects: []catalog.Project{{Name: "acme", Repo: repo}},
		Packages: []catalog.Package{
			{Name: "js-utils", Project: "acme", Repo: repo, Tag: catalog.DefaultTag,
				CI:       &catalog.CI{GitHubActions: &catalog.GitHubActions{Workflow: "js-utils.publish.yml"}},
				Artifact: &catalog.Artifact{NPM: &catalog.NPM{Name: "@telperion/js-utils"}}},
			{Name: "frp-gate", Project: "acme", Repo: repo, Tag: catalog.DefaultTag,
				Artifact: &catalog.Artifact{OCI: &catalog.OCI{Registry: "ghcr.io", Name: "telperiontech/frp-gate"}},
				Deploy:   []catalog.Deploy{{Target: "staging", CDEvents: true}}},
			{Name: "site", Project: "acme", Repo: repo, Tag: catalog.DefaultTag, CI: &catalog.CI{CDEvents: true}},
		},
	}
}

func TestParsePURL(t *testing.T) {
	p, err := ParsePURL("pkg:npm/%40telperion/js-utils@4.1.0")
	if err != nil || p.Type != "npm" || p.FullName() != "@telperion/js-utils" || p.Version != "4.1.0" {
		t.Errorf("npm purl = %+v %v", p, err)
	}
	p, err = ParsePURL("pkg:oci/frp-gate@sha256%3Aabc?repository_url=ghcr.io/telperiontech&tag=1.2.2")
	if err != nil || p.Name != "frp-gate" || p.Version != "sha256:abc" || p.Qualifiers.Get("tag") != "1.2.2" {
		t.Errorf("oci purl = %+v %v", p, err)
	}
	if _, err := ParsePURL("npm/x@1"); err == nil {
		t.Error("a string without pkg: parsed")
	}
}

func event(typ, subjectID, artifact, env string) cdEvent {
	var ev cdEvent
	ev.Context.Type = typ
	ev.Subject.ID = subjectID
	ev.Subject.Content.ArtifactID = artifact
	ev.Subject.Content.Environment.ID = env
	return ev
}

func TestMap(t *testing.T) {
	c := testCatalog()
	ci, narrow := c.CDEvents[0], c.CDEvents[1]
	o, err := Map(c, ci, event("dev.cdevents.artifact.published.0.2.0", "pkg:npm/%40telperion/js-utils@4.1.0", "", ""))
	if err != nil || o.Package != "js-utils" || o.Version != "4.1.0" || o.Stage != model.Published || o.State != model.OK {
		t.Errorf("npm published = %+v %v", o, err)
	}
	o, err = Map(c, ci, event("dev.cdevents.service.deployed.0.2.0", "gate", "pkg:oci/frp-gate@sha256:abc?repository_url=ghcr.io/telperiontech&tag=v1.2.2", "staging"))
	if err != nil || o.Package != "frp-gate" || o.Version != "1.2.2" || o.Target != "staging" || !o.Exclusive {
		t.Errorf("oci deployed = %+v %v", o, err)
	}
	o, err = Map(c, narrow, event("dev.cdevents.build.finished.0.2.0", "b", "pkg:generic/site@2.0.0", ""))
	if err != nil || o.Package != "site" || o.Stage != model.Built {
		t.Errorf("generic built = %+v %v", o, err)
	}
	for name, ev := range map[string]cdEvent{
		"not allowed":    event("dev.cdevents.build.finished.0.2.0", "b", "pkg:npm/%40telperion/js-utils@4.1.0", ""),
		"unknown target": event("dev.cdevents.service.deployed.0.2.0", "s", "pkg:generic/site@1.0.0", "prod"),
		"no package":     event("dev.cdevents.artifact.published.0.2.0", "pkg:npm/left-pad@1.0.0", "", ""),
		"merged":         event("dev.cdevents.change.merged.0.2.0", "c", "", ""),
	} {
		src := ci
		if name == "not allowed" {
			src = narrow
		}
		if _, err := Map(c, src, ev); err == nil {
			t.Errorf("%s: mapped", name)
		}
	}
}

func newStore(t *testing.T) *store.Store {
	t.Helper()
	st, err := store.Open(context.Background(), ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	if err := st.SaveCatalog(context.Background(), testCatalog()); err != nil {
		t.Fatal(err)
	}
	return st
}

func TestCDEventsHandler(t *testing.T) {
	t.Setenv("INGEST_TEST_CI", "ci-token")
	t.Setenv("INGEST_TEST_NARROW", "narrow-token")
	var got []model.Obs
	h := CDEvents{Store: newStore(t), Log: slog.New(slog.NewTextHandler(io.Discard, nil)),
		Ingest: func(obs []model.Obs) error { got = append(got, obs...); return nil }}
	body := `{"specversion": "1.0", "type": "dev.cdevents.artifact.published.0.2.0", "data": {
		"context": {"type": "dev.cdevents.artifact.published.0.2.0", "timestamp": "2026-11-01T10:00:00Z"},
		"subject": {"id": "pkg:npm/%40telperion/js-utils@4.2.0"}}}`

	send := func(token, ct, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/cdevents", strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", ct)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}
	if rec := send("wrong", "application/cloudevents+json", body); rec.Code != http.StatusUnauthorized {
		t.Errorf("a wrong token = %d", rec.Code)
	}
	if rec := send("ci-token", "application/cloudevents+json", body); rec.Code != http.StatusAccepted || len(got) != 1 || got[0].Version != "4.2.0" {
		t.Errorf("structured = %d %s, obs %+v", rec.Code, rec.Body, got)
	}
	rec := send("narrow-token", "application/cloudevents+json", body)
	if rec.Code != http.StatusAccepted || !strings.Contains(rec.Body.String(), "may not report on js-utils") || len(got) != 1 {
		t.Errorf("an event outside the source's packages = %d %s", rec.Code, rec.Body)
	}
}

func TestGitHubWebhookWakesJobs(t *testing.T) {
	t.Setenv("INGEST_TEST_HOOK", "hook-secret")
	var match func(observe.Job) bool
	g := GitHub{Store: newStore(t), Log: slog.New(slog.NewTextHandler(io.Discard, nil)),
		Wake: func(m func(observe.Job) bool) { match = m }}
	body := `{"repository": {"full_name": "acme/libs"}, "workflow_run": {"path": ".github/workflows/js-utils.publish.yml"}}`

	send := func(sig string) int {
		req := httptest.NewRequest(http.MethodPost, "/hooks/github", strings.NewReader(body))
		req.Header.Set("X-GitHub-Event", "workflow_run")
		req.Header.Set("X-Hub-Signature-256", sig)
		rec := httptest.NewRecorder()
		g.ServeHTTP(rec, req)
		return rec.Code
	}
	if code := send("sha256=00"); code != http.StatusUnauthorized || match != nil {
		t.Fatalf("a bad signature = %d", code)
	}
	if code := send(secret.Sign([]byte("hook-secret"), []byte(body))); code != http.StatusAccepted || match == nil {
		t.Fatalf("a signed delivery = %d", code)
	}
	repo := "https://github.example.com/acme/libs.git"
	if !match(observe.Job{Layer: "ci", Repo: repo, Workflow: "js-utils.publish.yml"}) ||
		match(observe.Job{Layer: "ci", Repo: repo, Workflow: "other.yml"}) ||
		match(observe.Job{Layer: "source", Repo: repo}) {
		t.Error("the hint wakes the wrong jobs")
	}
}
