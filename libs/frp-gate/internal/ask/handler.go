// Package ask answers Caddy's on-demand TLS permission check:
// GET /tls/ask?domain=<name> → 200 to allow a certificate, 403 otherwise.
package ask

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/metrics"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/policy"
)

// Decider is implemented by policy.Policy.
type Decider interface {
	Ask(ctx context.Context, host string) policy.Decision
}

// Handler serves the ask endpoint.
type Handler struct {
	Decider Decider
	Log     *slog.Logger
	Metrics *metrics.Metrics // optional
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	domain := r.URL.Query().Get("domain")
	d := h.Decider.Ask(r.Context(), domain)
	h.Metrics.Ask(d.Allow, d.Code)
	if !d.Allow {
		h.Log.Info("tls ask refused", "domain", domain, "reason", d.Reason)
		http.Error(w, d.Reason, http.StatusForbidden)
		return
	}
	h.Log.Info("tls ask approved", "domain", domain)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok\n"))
}
