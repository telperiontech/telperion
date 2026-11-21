package admin

import (
	"net/http"
	"time"
)

func (s *Server) statusPage(w http.ResponseWriter, r *http.Request) {
	wd, ok := s.loadWorld(w, r)
	if !ok {
		return
	}
	ss, err := s.svc.Store.Sessions(r.Context(), time.Now().Add(-s.sessionTimeout))
	if err != nil {
		s.redirect(w, r, "/clients", err, "")
		return
	}
	s.render(w, r, "status", pageData{Title: "Connected", Active: "status", W: wd,
		Data: map[string]any{"Sessions": wd.sessionViews(ss)}})
}
