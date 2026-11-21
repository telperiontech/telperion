package admin

import (
	"net/http"
	"net/url"
	"time"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

func (s *Server) clientsPage(w http.ResponseWriter, r *http.Request) {
	wd, ok := s.loadWorld(w, r)
	if !ok {
		return
	}
	s.render(w, r, "clients", pageData{Title: "Clients", Active: "clients", W: wd})
}

func (s *Server) clientCreate(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		s.redirect(w, r, "/clients", badInput("invalid form"), "")
		return
	}
	c, tok, err := s.svc.CreateClient(r.Context(), r.PostForm.Get("name"), r.PostForm.Get("note"), r.PostForm["groups"])
	if err != nil {
		s.redirect(w, r, "/clients", err, "")
		return
	}
	s.log.Info("client created", "client", c.Name)
	s.showClient(w, r, c, tok, "Client created. Copy the token now: it is not shown again.")
}

func (s *Server) clientPage(w http.ResponseWriter, r *http.Request) {
	c, err := s.svc.Client(r.Context(), r.PathValue("name"))
	if err != nil {
		s.redirect(w, r, "/clients", err, "")
		return
	}
	s.showClient(w, r, c, "", "")
}

// showClient renders a client; secret is set only right after create/rotate.
func (s *Server) showClient(w http.ResponseWriter, r *http.Request, c store.Client, secret, okMsg string) {
	ctx := r.Context()
	wd, ok := s.loadWorld(w, r)
	if !ok {
		return
	}
	grants, err := s.svc.Store.EffectiveGrants(ctx, c.ID)
	if err != nil {
		s.redirect(w, r, "/clients", err, "")
		return
	}
	groupIDs, err := s.svc.Store.GroupIDsOfClient(ctx, c.ID)
	if err != nil {
		s.redirect(w, r, "/clients", err, "")
		return
	}
	var groups []string
	for _, id := range groupIDs {
		groups = append(groups, wd.groups[id].Name)
	}
	all, err := s.svc.Store.Sessions(ctx, time.Now().Add(-s.sessionTimeout))
	if err != nil {
		s.redirect(w, r, "/clients", err, "")
		return
	}
	var mine []store.Session
	for _, x := range all {
		if x.ClientID == c.ID {
			mine = append(mine, x)
		}
	}
	s.render(w, r, "client", pageData{Title: c.Name, Active: "clients", W: wd, OK: okMsg, Data: map[string]any{
		"Client":   c,
		"Token":    secret,
		"Snippet":  frpcSnippet(wd, c, secret, grants),
		"Grants":   wd.grantViews(grants),
		"Groups":   groups,
		"Sessions": wd.sessionViews(mine),
	}})
}

func (s *Server) clientAction(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	name := r.PathValue("name")
	back := "/clients/" + url.PathEscape(name)
	var err error
	switch r.PathValue("action") {
	case "disable":
		err = s.svc.SetClientDisabled(ctx, name, true)
		s.log.Info("client disabled", "client", name, "err", err)
		s.redirect(w, r, back, err, "Client disabled. Its tunnels stop within one heartbeat.")
	case "enable":
		err = s.svc.SetClientDisabled(ctx, name, false)
		s.redirect(w, r, back, err, "Client enabled.")
	case "rotate":
		c, tok, err := s.svc.RotateClientToken(ctx, name)
		if err != nil {
			s.redirect(w, r, back, err, "")
			return
		}
		s.log.Info("client token rotated", "client", c.Name)
		s.showClient(w, r, c, tok, "New token issued; the old one no longer works. Copy it now.")
	case "delete":
		err = s.svc.DeleteClient(ctx, name)
		s.log.Info("client deleted", "client", name, "err", err)
		if err != nil {
			s.redirect(w, r, back, err, "")
			return
		}
		s.redirect(w, r, "/clients", nil, "Client "+name+" deleted.")
	default:
		http.NotFound(w, r)
	}
}
