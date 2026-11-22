package admin

import (
	"net/http"
	"strconv"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

const auditPageSize = 100

// auditEntries reads one page of the audit log; ?before=<id> pages back.
func (s *Server) auditEntries(r *http.Request) ([]store.AuditEntry, int64, error) {
	before, _ := strconv.ParseInt(r.URL.Query().Get("before"), 10, 64)
	entries, err := s.svc.Store.ListAudit(r.Context(), before, auditPageSize)
	var next int64
	if len(entries) == auditPageSize {
		next = entries[len(entries)-1].ID
	}
	return entries, next, err
}

func (s *Server) auditPage(w http.ResponseWriter, r *http.Request) {
	entries, next, err := s.auditEntries(r)
	if err != nil {
		s.redirect(w, r, "/status", err, "")
		return
	}
	s.render(w, r, "audit", pageData{Title: "Audit log", Active: "audit",
		Data: map[string]any{"Entries": entries, "Next": next}})
}

func (s *Server) apiAudit(w http.ResponseWriter, r *http.Request) {
	entries, next, err := s.auditEntries(r)
	s.apiResult(w, http.StatusOK, map[string]any{"entries": entries, "next_before": next}, err)
}
