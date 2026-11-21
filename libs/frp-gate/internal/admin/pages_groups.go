package admin

import "net/http"

func (s *Server) groupsPage(w http.ResponseWriter, r *http.Request) {
	wd, ok := s.loadWorld(w, r)
	if !ok {
		return
	}
	s.render(w, r, "groups", pageData{Title: "Groups", Active: "groups", W: wd,
		Data: map[string]any{"Groups": wd.groupViews()}})
}

func (s *Server) groupCreate(w http.ResponseWriter, r *http.Request) {
	g, err := s.svc.CreateGroup(r.Context(), r.PostFormValue("name"))
	s.redirect(w, r, "/groups", err, "Group "+g.Name+" created.")
}

func (s *Server) groupDelete(w http.ResponseWriter, r *http.Request) {
	err := s.svc.DeleteGroup(r.Context(), r.PathValue("name"))
	s.redirect(w, r, "/groups", err, "Group deleted with its grants.")
}

func (s *Server) memberAdd(w http.ResponseWriter, r *http.Request) {
	err := s.svc.SetMember(r.Context(), r.PathValue("name"), r.PostFormValue("client"), true)
	s.redirect(w, r, "/groups", err, "Member added.")
}

func (s *Server) memberRemove(w http.ResponseWriter, r *http.Request) {
	err := s.svc.SetMember(r.Context(), r.PathValue("name"), r.PathValue("client"), false)
	s.redirect(w, r, "/groups", err, "Member removed.")
}
