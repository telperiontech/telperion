package admin

import (
	"net/http"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

func (s *Server) instancesPage(w http.ResponseWriter, r *http.Request) {
	s.showInstances(w, r, store.Instance{}, "", "")
}

// showInstances renders the frps list; key is set only right after
// create/rotate so the frps.toml snippet can include it.
func (s *Server) showInstances(w http.ResponseWriter, r *http.Request, in store.Instance, key, okMsg string) {
	wd, ok := s.loadWorld(w, r)
	if !ok {
		return
	}
	data := map[string]any{"PluginAddr": s.pluginAddr}
	if key != "" {
		data["Created"] = in.Name
		data["Snippet"] = frpsSnippet(s.pluginAddr, key)
	}
	s.render(w, r, "instances", pageData{Title: "Servers", Active: "instances", W: wd, OK: okMsg, Data: data})
}

func (s *Server) instanceCreate(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		s.redirect(w, r, "/instances", badInput("invalid form"), "")
		return
	}
	in, key, err := s.svc.CreateInstance(r.Context(), r.PostForm.Get("name"), r.PostForm.Get("server_addr"), r.PostForm["zones"])
	if err != nil {
		s.redirect(w, r, "/instances", err, "")
		return
	}
	s.log.Info("instance created", "instance", in.Name)
	s.showInstances(w, r, in, key, "Server added. Put this block into its frps.toml now: the key is not shown again.")
}

func (s *Server) instanceAction(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	name := r.PathValue("name")
	switch r.PathValue("action") {
	case "zones":
		if err := r.ParseForm(); err != nil {
			s.redirect(w, r, "/instances", badInput("invalid form"), "")
			return
		}
		err := s.svc.SetInstanceZones(ctx, name, r.PostForm["zones"])
		s.redirect(w, r, "/instances", err, "Zones of "+name+" saved.")
	case "rotate":
		in, key, err := s.svc.RotateInstanceKey(ctx, name)
		if err != nil {
			s.redirect(w, r, "/instances", err, "")
			return
		}
		s.log.Info("instance key rotated", "instance", in.Name)
		s.showInstances(w, r, in, key, "New key issued; update frps.toml and restart frps.")
	case "delete":
		err := s.svc.DeleteInstance(ctx, name)
		s.log.Info("instance deleted", "instance", name, "err", err)
		s.redirect(w, r, "/instances", err, "Server "+name+" deleted.")
	default:
		http.NotFound(w, r)
	}
}
