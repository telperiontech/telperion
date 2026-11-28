// Package ingest serves the push side of observation on the ingest listener:
// GitHub App webhooks (POST /hooks/github) wake the poll jobs they concern,
// and CDEvents (POST /cdevents) become observations. Polling stays the
// baseline: a lost push only delays what the next poll sees.
package ingest

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"path"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/observe"
	"github.com/telperiontech/telperion/apps/beacon/internal/secret"
	"github.com/telperiontech/telperion/apps/beacon/internal/store"
)

// maxBody bounds a delivery (GitHub caps payloads at 25 MB; Beacon reads
// only small ones).
const maxBody = 5 << 20

// GitHub handles App webhooks. Deliveries are checked against the webhook
// secret (X-Hub-Signature-256) and turned into "poll this now" hints, so a
// webhook never writes state the API would not confirm.
type GitHub struct {
	Store *store.Store
	Wake  func(match func(observe.Job) bool)
	Log   *slog.Logger
}

type delivery struct {
	Repository struct {
		FullName string `json:"full_name"`
	} `json:"repository"`
	WorkflowRun struct {
		Path string `json:"path"` // .github/workflows/x.yml
	} `json:"workflow_run"`
}

func (g GitHub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	c, err := g.Store.LoadCatalog(r.Context())
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if c.GitHub == nil || c.GitHub.WebhookSecret.IsZero() {
		http.Error(w, "webhooks are not configured (github.webhook_secret_*)", http.StatusNotFound)
		return
	}
	key, err := secret.Value(c.GitHub.WebhookSecret)
	if err != nil {
		g.Log.Error("webhook secret unreadable", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBody))
	if err != nil {
		http.Error(w, "body too large", http.StatusRequestEntityTooLarge)
		return
	}
	if !secret.Verify([]byte(key), body, r.Header.Get("X-Hub-Signature-256")) {
		http.Error(w, "bad signature", http.StatusUnauthorized)
		return
	}
	event := r.Header.Get("X-GitHub-Event")
	var d delivery
	if event != "ping" && json.Unmarshal(body, &d) != nil {
		http.Error(w, "not JSON", http.StatusBadRequest)
		return
	}
	if match := Hint(c, event, d); match != nil {
		g.Wake(match)
	}
	w.WriteHeader(http.StatusAccepted)
}

// Hint is the jobs an event concerns (nil: none).
func Hint(c catalog.Catalog, event string, d delivery) func(observe.Job) bool {
	if d.Repository.FullName == "" || c.GitHub == nil {
		return nil
	}
	repo := c.GitHub.WebURL + "/" + d.Repository.FullName + ".git"
	layers := map[string][]string{
		"push":             {"source", "changes"},
		"create":           {"source", "changes"},
		"delete":           {"source", "changes"},
		"release":          {"source"},
		"workflow_run":     {"ci"},
		"registry_package": {"artifact"},
		"package":          {"artifact"},
	}[event]
	if layers == nil {
		return nil // unknown events are acknowledged and dropped
	}
	workflow := path.Base(d.WorkflowRun.Path)
	return func(j observe.Job) bool {
		if j.Repo != repo {
			return false
		}
		for _, l := range layers {
			if j.Layer == l && (l != "ci" || j.Workflow == workflow) {
				return true
			}
		}
		return false
	}
}
