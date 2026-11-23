package admin

import (
	"net/http"
	"strconv"
	"time"
)

// apiStatus lists the connected sessions, each with its client and open proxies.
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

// apiClients lists every client.
func (s *Server) apiClients(w http.ResponseWriter, r *http.Request) {
	cs, err := s.svc.Store.ListClients(r.Context())
	s.apiResult(w, http.StatusOK, map[string]any{"clients": cs}, err)
}

// apiClientCreate creates a client. Its token is in the answer only this once,
// with a ready frpc.toml.
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

// apiClient returns one client with its effective grants (its own and its
// groups') and its frpc.toml, without the token.
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

// apiClientAction disables, enables or rotates a client: action is disable,
// enable or rotate. Rotate returns the new token, shown only this once.
// Disable works on managed clients too.
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

// apiClientDelete deletes a client and its own grants.
func (s *Server) apiClientDelete(w http.ResponseWriter, r *http.Request) {
	err := s.svc.DeleteClient(r.Context(), r.PathValue("name"))
	s.log.Info("client deleted", "client", r.PathValue("name"), "err", err)
	s.apiResult(w, http.StatusOK, nil, err)
}

// apiZones lists the zones.
func (s *Server) apiZones(w http.ResponseWriter, r *http.Request) {
	zs, err := s.svc.Store.ListZones(r.Context())
	s.apiResult(w, http.StatusOK, map[string]any{"zones": zs}, err)
}

// apiZoneCreate adds a zone: a base domain pointed at the gateway.
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

// apiZoneDelete deletes a zone.
func (s *Server) apiZoneDelete(w http.ResponseWriter, r *http.Request) {
	s.apiResult(w, http.StatusOK, nil, s.svc.DeleteZone(r.Context(), r.PathValue("domain")))
}

// apiInstances lists the servers (frps instances) with their zones.
func (s *Server) apiInstances(w http.ResponseWriter, r *http.Request) {
	wd, err := s.svc.world(r.Context())
	if err != nil {
		s.apiResult(w, 0, nil, err)
		return
	}
	s.apiResult(w, http.StatusOK, map[string]any{"instances": wd.instanceViews()}, nil)
}

// apiInstanceCreate adds a server. Its plugin key is in the answer only this
// once, with a ready frps.toml.
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

// apiInstanceZones sets the zones a server may serve, replacing its list.
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

// apiInstanceRotate gives a server a new plugin key; update its frps.toml.
func (s *Server) apiInstanceRotate(w http.ResponseWriter, r *http.Request) {
	_, key, err := s.svc.RotateInstanceKey(r.Context(), r.PathValue("name"))
	s.apiResult(w, http.StatusOK, map[string]any{"key": key, "frps_toml": frpsSnippet(s.pluginAddr, key)}, err)
}

// apiInstanceDelete deletes a server.
func (s *Server) apiInstanceDelete(w http.ResponseWriter, r *http.Request) {
	s.apiResult(w, http.StatusOK, nil, s.svc.DeleteInstance(r.Context(), r.PathValue("name")))
}

// apiGroups lists the groups with their members.
func (s *Server) apiGroups(w http.ResponseWriter, r *http.Request) {
	wd, err := s.svc.world(r.Context())
	if err != nil {
		s.apiResult(w, 0, nil, err)
		return
	}
	s.apiResult(w, http.StatusOK, map[string]any{"groups": wd.groupViews()}, nil)
}

// apiGroupCreate adds a group.
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

// apiGroupDelete deletes a group and its grants.
func (s *Server) apiGroupDelete(w http.ResponseWriter, r *http.Request) {
	s.apiResult(w, http.StatusOK, nil, s.svc.DeleteGroup(r.Context(), r.PathValue("name")))
}

// apiMember adds a client to a group (PUT) or removes it (DELETE).
func (s *Server) apiMember(member bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		err := s.svc.SetMember(r.Context(), r.PathValue("name"), r.PathValue("client"), member)
		s.apiResult(w, http.StatusOK, nil, err)
	}
}

// apiGrants lists every grant.
func (s *Server) apiGrants(w http.ResponseWriter, r *http.Request) {
	wd, err := s.svc.world(r.Context())
	if err != nil {
		s.apiResult(w, 0, nil, err)
		return
	}
	s.apiResult(w, http.StatusOK, map[string]any{"grants": wd.grantViews(wd.Grants)}, nil)
}

// apiGrantCreate adds a grant for a client or a group: kind host with zone
// and pattern, or kind port with instance, proto and ports ("25565" or
// "6000-6010").
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

// apiGrantDelete deletes a grant by its id.
func (s *Server) apiGrantDelete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		s.apiResult(w, 0, nil, badInput("grant id must be a number"))
		return
	}
	s.apiResult(w, http.StatusOK, nil, s.svc.DeleteGrant(r.Context(), id))
}
