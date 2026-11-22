package admin

import (
	"net/http"
	"strconv"
	"strings"
)

func (s *Server) grantsPage(w http.ResponseWriter, r *http.Request) {
	wd, ok := s.loadWorld(w, r)
	if !ok {
		return
	}
	s.render(w, r, "grants", pageData{Title: "Grants", Active: "grants", W: wd,
		Data: map[string]any{"Grants": wd.grantViews(wd.Grants)}})
}

func (s *Server) grantCreate(w http.ResponseWriter, r *http.Request) {
	in := GrantInput{
		Kind: r.PostFormValue("kind"), Zone: r.PostFormValue("zone"), Pattern: r.PostFormValue("pattern"),
		Instance: r.PostFormValue("instance"), Proto: r.PostFormValue("proto"), Ports: r.PostFormValue("ports"),
	}
	// The subject select sends "client:<name>" or "group:<name>".
	switch kind, name, _ := strings.Cut(r.PostFormValue("subject"), ":"); kind {
	case "client":
		in.Client = name
	case "group":
		in.Group = name
	}
	_, err := s.svc.CreateGrant(r.Context(), in)
	s.redirect(w, r, "/grants", err, "Grant added.")
}

func (s *Server) grantDelete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err == nil {
		err = s.svc.DeleteGrant(r.Context(), id)
	}
	s.redirect(w, r, "/grants", err, "Grant removed. Sessions using it are cut off at their next heartbeat.")
}
