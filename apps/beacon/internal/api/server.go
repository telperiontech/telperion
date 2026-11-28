// Package api serves the admin listener: the JSON API and SSE stream under
// /api (session cookie or HTTP Basic with the admin password), and the
// embedded UI for everything else. Cross-origin writes are refused
// (http.CrossOriginProtection).
package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/telperiontech/telperion/apps/beacon/internal/observe"
	"github.com/telperiontech/telperion/apps/beacon/internal/plan"
	"github.com/telperiontech/telperion/apps/beacon/internal/store"
	"github.com/telperiontech/telperion/libs/go-kit/session"
)

// Options configure the admin handler.
type Options struct {
	Views  Views
	Store  *store.Store
	Auth   *session.Auth
	Broker *observe.Broker
	Status func() []observe.JobStatus
	Plans  plan.Env
	Runner Runner
	UI     http.Handler
	Log    *slog.Logger
}

type server struct{ Options }

// New builds the admin handler.
func New(o Options) http.Handler {
	s := server{o}
	api := http.NewServeMux()
	api.HandleFunc("GET /api/overview", s.overview)
	api.HandleFunc("GET /api/packages/{name}", s.pkg)
	api.HandleFunc("GET /api/packages/{name}/events", s.packageEvents)
	api.HandleFunc("GET /api/audit", s.audit)
	api.HandleFunc("GET /api/status", s.status)
	api.HandleFunc("GET /api/events", s.stream)
	api.HandleFunc("POST /api/actions/preview", s.preview)
	api.HandleFunc("POST /api/actions", s.start)
	api.HandleFunc("GET /api/runs", s.runs)
	api.HandleFunc("GET /api/runs/{id}", s.run)
	api.HandleFunc("POST /api/runs/{id}/cancel", s.cancel)
	api.HandleFunc("/api/", func(w http.ResponseWriter, _ *http.Request) {
		writeError(w, http.StatusNotFound, "no such endpoint")
	})
	deny := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		writeError(w, http.StatusUnauthorized, "log in first")
	})

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/session", s.session)
	mux.HandleFunc("POST /api/login", s.login)
	mux.HandleFunc("POST /api/logout", s.logout)
	mux.Handle("/api/", o.Auth.Require(api, deny))
	mux.Handle("/", readOnly(o.UI))
	return securityHeaders(http.NewCrossOriginProtection().Handler(mux))
}

// readOnly allows GET and HEAD only (the UI's files).
func readOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// csp allows only Beacon's own files; Angular component styles are inline
// <style> elements.
const csp = "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
	"connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("Content-Security-Policy", csp)
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "same-origin")
		next.ServeHTTP(w, r)
	})
}

func (s server) overview(w http.ResponseWriter, r *http.Request) {
	o, err := s.Views.Overview(r.Context())
	s.respond(w, o, err)
}

func (s server) pkg(w http.ResponseWriter, r *http.Request) {
	d, err := s.Views.Package(r.Context(), r.PathValue("name"))
	s.respond(w, d, err)
}

func (s server) packageEvents(w http.ResponseWriter, r *http.Request) {
	before, limit := paging(r)
	evs, err := s.Store.Events(r.Context(), r.PathValue("name"), before, limit)
	s.respond(w, evs, err)
}

func (s server) audit(w http.ResponseWriter, r *http.Request) {
	before, limit := paging(r)
	entries, err := s.Store.ListAudit(r.Context(), before, limit)
	s.respond(w, entries, err)
}

func (s server) status(w http.ResponseWriter, _ *http.Request) {
	s.respond(w, s.Status(), nil)
}

// paging reads ?before=<id>&limit=<n> (limit 1..200, default 50).
func paging(r *http.Request) (before int64, limit int) {
	before, _ = strconv.ParseInt(r.URL.Query().Get("before"), 10, 64)
	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit < 1 {
		limit = 50
	}
	return before, min(limit, 200)
}

func (s server) respond(w http.ResponseWriter, v any, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		writeError(w, http.StatusNotFound, "not found")
	case err != nil:
		s.Log.Error("api request failed", "err", err)
		writeError(w, http.StatusInternalServerError, "internal error")
	default:
		writeJSON(w, http.StatusOK, v)
	}
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}
