package admin

import (
	"context"
	"fmt"
	"time"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/portrange"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// world is a snapshot of all admin-visible state with id → name lookups.
// The data set is small (tens of rows), so pages simply load all of it.
type world struct {
	Clients   []store.Client
	Groups    []store.Group
	Zones     []store.Zone
	Instances []store.Instance
	Grants    []store.Grant

	clients   map[int64]store.Client
	groups    map[int64]store.Group
	zones     map[int64]store.Zone
	instances map[int64]store.Instance
}

func (s *Service) world(ctx context.Context) (*world, error) {
	w := &world{
		clients: map[int64]store.Client{}, groups: map[int64]store.Group{},
		zones: map[int64]store.Zone{}, instances: map[int64]store.Instance{},
	}
	var err error
	if w.Clients, err = s.Store.ListClients(ctx); err != nil {
		return nil, err
	}
	if w.Groups, err = s.Store.ListGroups(ctx); err != nil {
		return nil, err
	}
	if w.Zones, err = s.Store.ListZones(ctx); err != nil {
		return nil, err
	}
	if w.Instances, err = s.Store.ListInstances(ctx); err != nil {
		return nil, err
	}
	if w.Grants, err = s.Store.ListGrants(ctx); err != nil {
		return nil, err
	}
	for _, c := range w.Clients {
		w.clients[c.ID] = c
	}
	for _, g := range w.Groups {
		w.groups[g.ID] = g
	}
	for _, z := range w.Zones {
		w.zones[z.ID] = z
	}
	for _, in := range w.Instances {
		w.instances[in.ID] = in
	}
	return w, nil
}

// grantView is a grant described by names, for pages and the API.
type grantView struct {
	ID          int64  `json:"id"`
	SubjectKind string `json:"subject_kind"` // client | group
	Subject     string `json:"subject"`
	Kind        string `json:"kind"`
	Zone        string `json:"zone,omitempty"`
	Pattern     string `json:"pattern,omitempty"`
	Instance    string `json:"instance,omitempty"`
	Proto       string `json:"proto,omitempty"`
	Ports       string `json:"ports,omitempty"`
	Managed     bool   `json:"managed"`
}

// Target is a one-line description of what the grant allows.
func (g grantView) Target() string {
	if g.Kind == store.KindHost {
		return g.Pattern
	}
	return fmt.Sprintf("%s %s on %s", g.Proto, g.Ports, g.Instance)
}

func (w *world) grantView(g store.Grant) grantView {
	v := grantView{ID: g.ID, Kind: g.Kind, Pattern: g.Pattern, Proto: g.Proto, Managed: g.Managed}
	if g.ClientID != 0 {
		v.SubjectKind, v.Subject = "client", w.clients[g.ClientID].Name
	} else {
		v.SubjectKind, v.Subject = "group", w.groups[g.GroupID].Name
	}
	if g.Kind == store.KindHost {
		v.Zone = w.zones[g.ZoneID].Domain
	} else {
		v.Instance = w.instances[g.InstanceID].Name
		v.Ports = portrange.Format(g.PortFrom, g.PortTo)
	}
	return v
}

func (w *world) grantViews(grants []store.Grant) []grantView {
	out := make([]grantView, 0, len(grants))
	for _, g := range grants {
		out = append(out, w.grantView(g))
	}
	return out
}

// groupView is a group with member names.
type groupView struct {
	ID      int64    `json:"id"`
	Name    string   `json:"name"`
	Members []string `json:"members"`
	Managed bool     `json:"managed"`
}

func (w *world) groupViews() []groupView {
	out := []groupView{}
	for _, g := range w.Groups {
		v := groupView{ID: g.ID, Name: g.Name, Members: []string{}, Managed: g.Managed}
		for _, id := range g.MemberIDs {
			v.Members = append(v.Members, w.clients[id].Name)
		}
		out = append(out, v)
	}
	return out
}

// instanceView is an frps with zone names.
type instanceView struct {
	Name       string   `json:"name"`
	ServerAddr string   `json:"server_addr"`
	Zones      []string `json:"zones"`
	Managed    bool     `json:"managed"`
	KeyManaged bool     `json:"key_managed"`
}

func (w *world) instanceViews() []instanceView {
	out := []instanceView{}
	for _, in := range w.Instances {
		v := instanceView{Name: in.Name, ServerAddr: in.ServerAddr, Zones: []string{},
			Managed: in.Managed, KeyManaged: in.SecretManaged}
		for _, id := range in.ZoneIDs {
			v.Zones = append(v.Zones, w.zones[id].Domain)
		}
		out = append(out, v)
	}
	return out
}

// sessionView is a connected frpc.
type sessionView struct {
	Client    string        `json:"client"`
	Instance  string        `json:"instance"`
	RunID     string        `json:"run_id"`
	FirstSeen time.Time     `json:"first_seen"`
	LastSeen  time.Time     `json:"last_seen"`
	Proxies   []store.Proxy `json:"proxies"`
}

func (w *world) sessionViews(ss []store.Session) []sessionView {
	out := []sessionView{}
	for _, x := range ss {
		out = append(out, sessionView{
			Client: w.clients[x.ClientID].Name, Instance: w.instances[x.InstanceID].Name,
			RunID: x.RunID, FirstSeen: x.FirstSeen, LastSeen: x.LastSeen, Proxies: x.Proxies,
		})
	}
	return out
}
