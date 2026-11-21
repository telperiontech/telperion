package admin

import "net/http"

func (s *Server) zonesPage(w http.ResponseWriter, r *http.Request) {
	wd, ok := s.loadWorld(w, r)
	if !ok {
		return
	}
	s.render(w, r, "zones", pageData{Title: "Zones", Active: "zones", W: wd,
		Data: map[string]any{"Instances": wd.instanceViews()}})
}

func (s *Server) zoneCreate(w http.ResponseWriter, r *http.Request) {
	z, err := s.svc.CreateZone(r.Context(), r.PostFormValue("domain"))
	s.redirect(w, r, "/zones", err, "Zone "+z.Domain+" added. Attach it to an frps under Servers.")
}

func (s *Server) zoneDelete(w http.ResponseWriter, r *http.Request) {
	err := s.svc.DeleteZone(r.Context(), r.PathValue("domain"))
	s.redirect(w, r, "/zones", err, "Zone deleted.")
}
