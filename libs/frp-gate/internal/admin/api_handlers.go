package admin

import (
	"net/http"
	"strconv"
	"time"
)

func (s *Server) apiStatus(w http.ResponseWriter, r *http.Request) {
	wd, err := s.svc.world(r.Context())
	if err != nil {
		s.apiResult(w, 0, nil, err)
		return
	}
	ss, err := s.svc.Store.Sessions(r.Context(), time.Now().Add(-s.sessionTimeout))
	if err != nil {
		s.apiResult(w, 0, nil, err)
		return
	}
	s.apiResult(w, http.StatusOK, map[string]any{"sessions": wd.sessionViews(ss)}, nil)
}

func (s *Server) apiClients(w http.ResponseWriter, r *http.Request) {
	cs, err := s.svc.Store.ListClients(r.Context())
	s.apiResult(w, http.StatusOK, map[string]any{"clients": cs}, err)
}

func (s *Server) apiClientCreate(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name   string   `json:"name"`
		Note   string   `json:"note"`
		Groups []string `json:"groups"`
	}
	if err := readJSON(r, &in); err != nil {
		s.apiResult(w, 0, nil, err)
		return
	}
	c, tok, err := s.svc.CreateClient(r.Context(), in.Name, in.Note, in.Groups)
	if err != nil {
		s.apiResult(w, 0, nil, err)
		return
	}
	s.log.Info("client created", "client", c.Name)
	wd, err := s.svc.world(r.Context())
	if err != nil {
		s.apiResult(w, 0, nil, err)
		return
	}
	grants, err := s.svc.Store.EffectiveGrants(r.Context(), c.ID)
	s.apiResult(w, http.StatusCreated, map[string]any{
		"client": c, "token": tok, "frpc_toml": frpcSnippet(wd, c, tok, grants),
	}, err)
}

func (s *Server) apiClient(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	c, err := s.svc.Client(ctx, r.PathValue("name"))
	if err != nil {
		s.apiResult(w, 0, nil, err)
		return
	}
	wd, err := s.svc.world(ctx)
	if err != nil {
		s.apiResult(w, 0, nil, err)
		return
	}
	grants, err := s.svc.Store.EffectiveGrants(ctx, c.ID)
	s.apiResult(w, http.StatusOK, map[string]any{
		"client": c, "grants": wd.grantViews(grants), "frpc_toml": frpcSnippet(wd, c, "", grants),
	}, err)
}

func (s *Server) apiClientAction(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	name := r.PathValue("name")
	switch r.PathValue("action") {
	case "disable", "enable":
		disabled := r.PathValue("action") == "disable"
		err := s.svc.SetClientDisabled(ctx, name, disabled)
		s.log.Info("client "+r.PathValue("action")+"d", "client", name, "err", err)
		s.apiResult(w, http.StatusOK, nil, err)
	case "rotate":
		c, tok, err := s.svc.RotateClientToken(ctx, name)
		if err == nil {
			s.log.Info("client token rotated", "client", c.Name)
		}
		s.apiResult(w, http.StatusOK, map[string]any{"client": c, "token": tok}, err)
	default:
		s.apiResult(w, 0, nil, badInput("unknown action %q", r.PathValue("action")))
	}
}

func (s *Server) apiClientDelete(w http.ResponseWriter, r *http.Request) {
	err := s.svc.DeleteClient(r.Context(), r.PathValue("name"))
	s.log.Info("client deleted", "client", r.PathValue("name"), "err", err)
	s.apiResult(w, http.StatusOK, nil, err)
}

func (s *Server) apiZones(w http.ResponseWriter, r *http.Request) {
	zs, err := s.svc.Store.ListZones(r.Context())
	s.apiResult(w, http.StatusOK, map[string]any{"zones": zs}, err)
}

func (s *Server) apiZoneCreate(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Domain string `json:"domain"`
	}
	if err := readJSON(r, &in); err != nil {
		s.apiResult(w, 0, nil, err)
		return
	}
	z, err := s.svc.CreateZone(r.Context(), in.Domain)
	s.apiResult(w, http.StatusCreated, z, err)
}

func (s *Server) apiZoneDelete(w http.ResponseWriter, r *http.Request) {
	s.apiResult(w, http.StatusOK, nil, s.svc.DeleteZone(r.Context(), r.PathValue("domain")))
}

func (s *Server) apiInstances(w http.ResponseWriter, r *http.Request) {
	wd, err := s.svc.world(r.Context())
	if err != nil {
		s.apiResult(w, 0, nil, err)
		return
	}
	s.apiResult(w, http.StatusOK, map[string]any{"instances": wd.instanceViews()}, nil)
}

func (s *Server) apiInstanceCreate(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name       string   `json:"name"`
		ServerAddr string   `json:"server_addr"`
		Zones      []string `json:"zones"`
	}
	if err := readJSON(r, &in); err != nil {
		s.apiResult(w, 0, nil, err)
		return
	}
	inst, key, err := s.svc.CreateInstance(r.Context(), in.Name, in.ServerAddr, in.Zones)
	if err != nil {
		s.apiResult(w, 0, nil, err)
		return
	}
	s.apiResult(w, http.StatusCreated, map[string]any{"instance": inst, "key": key, "frps_toml": frpsSnippet(s.pluginAddr, key)}, nil)
}

func (s *Server) apiInstanceZones(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Zones []string `json:"zones"`
	}
	if err := readJSON(r, &in); err != nil {
		s.apiResult(w, 0, nil, err)
		return
	}
	s.apiResult(w, http.StatusOK, nil, s.svc.SetInstanceZones(r.Context(), r.PathValue("name"), in.Zones))
}

func (s *Server) apiInstanceRotate(w http.ResponseWriter, r *http.Request) {
	_, key, err := s.svc.RotateInstanceKey(r.Context(), r.PathValue("name"))
	s.apiResult(w, http.StatusOK, map[string]any{"key": key, "frps_toml": frpsSnippet(s.pluginAddr, key)}, err)
}

func (s *Server) apiInstanceDelete(w http.ResponseWriter, r *http.Request) {
	s.apiResult(w, http.StatusOK, nil, s.svc.DeleteInstance(r.Context(), r.PathValue("name")))
}

func (s *Server) apiGroups(w http.ResponseWriter, r *http.Request) {
	wd, err := s.svc.world(r.Context())
	if err != nil {
		s.apiResult(w, 0, nil, err)
		return
	}
	s.apiResult(w, http.StatusOK, map[string]any{"groups": wd.groupViews()}, nil)
}

func (s *Server) apiGroupCreate(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name string `json:"name"`
	}
	if err := readJSON(r, &in); err != nil {
		s.apiResult(w, 0, nil, err)
		return
	}
	g, err := s.svc.CreateGroup(r.Context(), in.Name)
	s.apiResult(w, http.StatusCreated, g, err)
}

func (s *Server) apiGroupDelete(w http.ResponseWriter, r *http.Request) {
	s.apiResult(w, http.StatusOK, nil, s.svc.DeleteGroup(r.Context(), r.PathValue("name")))
}

func (s *Server) apiMember(member bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		err := s.svc.SetMember(r.Context(), r.PathValue("name"), r.PathValue("client"), member)
		s.apiResult(w, http.StatusOK, nil, err)
	}
}

func (s *Server) apiGrants(w http.ResponseWriter, r *http.Request) {
	wd, err := s.svc.world(r.Context())
	if err != nil {
		s.apiResult(w, 0, nil, err)
		return
	}
	s.apiResult(w, http.StatusOK, map[string]any{"grants": wd.grantViews(wd.Grants)}, nil)
}

func (s *Server) apiGrantCreate(w http.ResponseWriter, r *http.Request) {
	var in GrantInput
	if err := readJSON(r, &in); err != nil {
		s.apiResult(w, 0, nil, err)
		return
	}
	g, err := s.svc.CreateGrant(r.Context(), in)
	if err != nil {
		s.apiResult(w, 0, nil, err)
		return
	}
	wd, err := s.svc.world(r.Context())
	if err != nil {
		s.apiResult(w, 0, nil, err)
		return
	}
	s.apiResult(w, http.StatusCreated, wd.grantView(g), nil)
}

func (s *Server) apiGrantDelete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		s.apiResult(w, 0, nil, badInput("grant id must be a number"))
		return
	}
	s.apiResult(w, http.StatusOK, nil, s.svc.DeleteGrant(r.Context(), id))
}
