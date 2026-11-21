// Package ask answers Caddy's on-demand TLS permission check:
// GET /tls/ask?domain=<name> → 200 to allow a certificate, 403 otherwise.
package ask

import (
	"context"
	"log/slog"
	"net/http"
)

// Decider is implemented by policy.Policy.
type Decider interface {
	Ask(ctx context.Context, host string) (bool, string)
}

// Handler serves the ask endpoint.
type Handler struct {
	Decider Decider
	Log     *slog.Logger
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	domain := r.URL.Query().Get("domain")
	ok, reason := h.Decider.Ask(r.Context(), domain)
	if !ok {
		h.Log.Info("tls ask refused", "domain", domain, "reason", reason)
		http.Error(w, reason, http.StatusForbidden)
		return
	}
	h.Log.Info("tls ask approved", "domain", domain)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok\n"))
}
