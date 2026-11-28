package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/telperiontech/telperion/apps/beacon/internal/plan"
	"github.com/telperiontech/telperion/apps/beacon/internal/store"
	"github.com/telperiontech/telperion/libs/go-kit/audit"
)

// Runner is the plan runner as the API uses it.
type Runner interface {
	Kick()
	Cancel(ctx context.Context, run int64) error
	Resume(ctx context.Context, run int64) error
}

// startBody is POST /api/actions: the action, recipe or plan, and what the
// user confirmed on its preview.
type startBody struct {
	plan.Request
	Confirm plan.Confirm `json:"confirm"`
}

// preview answers what an action, recipe or plan would do; nothing is
// written.
func (s server) preview(w http.ResponseWriter, r *http.Request) {
	var req plan.Request
	if !readJSON(w, r, &req) {
		return
	}
	p, err := s.Plans.Preview(r.Context(), req)
	s.respond(w, p, err)
}

// start starts an action whose preview the user confirmed. When the state
// moved since the preview (409), it has errors (422) or a major version needs
// its own tick (428), the answer carries the current preview.
func (s server) start(w http.ResponseWriter, r *http.Request) {
	var body startBody
	if !readJSON(w, r, &body) {
		return
	}
	ctx := audit.WithActor(r.Context(), actor(r))
	id, p, err := s.Plans.Start(ctx, body.Request, body.Confirm, s.Runner.Kick)
	code := map[error]int{plan.ErrMoved: http.StatusConflict, plan.ErrInvalid: http.StatusUnprocessableEntity,
		plan.ErrConfirm: http.StatusPreconditionRequired}
	for e, c := range code {
		if errors.Is(err, e) {
			writeJSON(w, c, map[string]any{"error": err.Error(), "preview": p})
			return
		}
	}
	if err != nil {
		s.respond(w, nil, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]int64{"run": id})
}

func (s server) runs(w http.ResponseWriter, r *http.Request) {
	before, limit := paging(r)
	runs, err := s.Store.ListRuns(r.Context(), before, limit)
	s.respond(w, runs, err)
}

func (s server) run(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	run, err := s.Store.Run(r.Context(), id)
	if errors.Is(err, store.ErrNoRun) {
		err = ErrNotFound
	}
	s.respond(w, run, err)
}

// cancel stops a run; what it started (a CI run, a deploy) goes on.
func (s server) cancel(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	switch err := s.Runner.Cancel(audit.WithActor(r.Context(), actor(r)), id); {
	case errors.Is(err, store.ErrNoRun):
		writeError(w, http.StatusNotFound, "not found")
	case err != nil:
		writeError(w, http.StatusConflict, err.Error())
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}

// actor is who acts: the admin, through the UI (session) or the API (Basic).
func actor(r *http.Request) audit.Actor {
	src := "ui"
	if _, _, basic := r.BasicAuth(); basic {
		src = "api"
	}
	return audit.Actor{Source: src, Who: "admin@" + r.RemoteAddr}
}

func readJSON(w http.ResponseWriter, r *http.Request, out any) bool {
	dec := json.NewDecoder(io.LimitReader(r.Body, 64<<10))
	dec.DisallowUnknownFields()
	if err := dec.Decode(out); err != nil {
		writeError(w, http.StatusBadRequest, "bad JSON: "+err.Error())
		return false
	}
	return true
}
