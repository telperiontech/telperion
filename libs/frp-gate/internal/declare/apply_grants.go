package declare

import (
	"errors"
	"fmt"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/portrange"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// grantKey is what makes two grants the same; grants have no name.
type grantKey struct {
	client, group, zone, instance int64
	kind, pattern, proto          string
	from, to                      int
}

func keyOf(g store.Grant) grantKey {
	return grantKey{g.ClientID, g.GroupID, g.ZoneID, g.InstanceID, g.Kind, g.Pattern, g.Proto, g.PortFrom, g.PortTo}
}

// grants creates the declared grants, adopts identical ones made in the UI
// and deletes managed grants that left the file.
func (a *applier) grants() error {
	cur, err := a.st.ListGrants(a.ctx)
	if err != nil {
		return err
	}
	matched := map[int64]bool{}
	for _, dg := range a.d.Grants {
		want := store.Grant{Kind: dg.Kind, Pattern: dg.Pattern, Proto: dg.Proto, PortFrom: dg.PortFrom, PortTo: dg.PortTo}
		if dg.Client != "" {
			want.ClientID = a.clientID[dg.Client]
		} else {
			want.GroupID = a.groupID[dg.Group]
		}
		if dg.Kind == store.KindHost {
			want.ZoneID = a.zoneID[dg.Zone]
		} else {
			want.InstanceID = a.instanceID[dg.Instance]
		}
		found := false
		for _, g := range cur {
			if !matched[g.ID] && keyOf(g) == keyOf(want) {
				matched[g.ID], found = true, true
				if err := a.adopt("grants", "grant", dg.String(), g.ID, g.Managed); err != nil {
					return err
				}
				break
			}
		}
		if found {
			continue
		}
		g, err := a.st.CreateGrant(a.ctx, want)
		if err != nil {
			return err
		}
		if err := a.st.SetManaged(a.ctx, "grants", g.ID, true); err != nil {
			return err
		}
		if err := a.change(OpCreate, "grant", dg.String()); err != nil {
			return err
		}
	}
	names, err := a.loadNames()
	if err != nil {
		return err
	}
	for _, g := range cur {
		if !g.Managed || matched[g.ID] {
			continue
		}
		if err := a.st.DeleteGrant(a.ctx, g.ID); err != nil {
			return err
		}
		if err := a.change(OpDelete, "grant", names.grant(g)); err != nil {
			return err
		}
	}
	return nil
}

// deleteClients, deleteGroups, deleteInstances and deleteZones remove
// managed objects that are no longer in the file. Objects made in the UI
// are never deleted.
func (a *applier) deleteClients() error {
	cs, err := a.st.ListClients(a.ctx)
	if err != nil {
		return err
	}
	for _, c := range cs {
		if c.Managed && a.clientID[c.Name] == 0 {
			if err := a.st.DeleteClient(a.ctx, c.ID); err != nil {
				return err
			}
			if err := a.change(OpDelete, "client", c.Name, "with its sessions and remaining grants"); err != nil {
				return err
			}
		}
	}
	return nil
}

func (a *applier) deleteGroups() error {
	gs, err := a.st.ListGroups(a.ctx)
	if err != nil {
		return err
	}
	for _, g := range gs {
		if g.Managed && a.groupID[g.Name] == 0 {
			if err := a.st.DeleteGroup(a.ctx, g.ID); err != nil {
				return err
			}
			if err := a.change(OpDelete, "group", g.Name); err != nil {
				return err
			}
		}
	}
	return nil
}

func (a *applier) deleteInstances() error {
	is, err := a.st.ListInstances(a.ctx)
	if err != nil {
		return err
	}
	for _, in := range is {
		if in.Managed && a.instanceID[in.Name] == 0 {
			if err := a.st.DeleteInstance(a.ctx, in.ID); err != nil {
				return err
			}
			if err := a.change(OpDelete, "instance", in.Name, "with its port grants and sessions"); err != nil {
				return err
			}
		}
	}
	return nil
}

func (a *applier) deleteZones() error {
	zs, err := a.st.ListZones(a.ctx)
	if err != nil {
		return err
	}
	for _, z := range zs {
		if z.Managed && a.zoneID[z.Domain] == 0 {
			if err := a.st.DeleteZone(a.ctx, z.ID); errors.Is(err, store.ErrInUse) {
				return fmt.Errorf("zone %s left the file, but grants made in the UI still use it; remove them first", z.Domain)
			} else if err != nil {
				return err
			}
			if err := a.change(OpDelete, "zone", z.Domain); err != nil {
				return err
			}
		}
	}
	return nil
}

// nameMaps turns ids back into names to describe existing grants.
type nameMaps struct {
	clients, groups, zones, instances map[int64]string
}

func (a *applier) loadNames() (nameMaps, error) {
	n := nameMaps{map[int64]string{}, map[int64]string{}, map[int64]string{}, map[int64]string{}}
	var err error
	if n.clients, err = a.clientNames(); err != nil {
		return n, err
	}
	if n.zones, err = a.zoneNames(); err != nil {
		return n, err
	}
	gs, err := a.st.ListGroups(a.ctx)
	if err != nil {
		return n, err
	}
	for _, g := range gs {
		n.groups[g.ID] = g.Name
	}
	is, err := a.st.ListInstances(a.ctx)
	if err != nil {
		return n, err
	}
	for _, in := range is {
		n.instances[in.ID] = in.Name
	}
	return n, nil
}

func (n nameMaps) grant(g store.Grant) string {
	dg := DesiredGrant{Kind: g.Kind, Pattern: g.Pattern, Proto: g.Proto, PortFrom: g.PortFrom, PortTo: g.PortTo,
		Client: n.clients[g.ClientID], Group: n.groups[g.GroupID], Instance: n.instances[g.InstanceID]}
	if g.Kind != store.KindHost && dg.Instance == "" {
		return fmt.Sprintf("#%d %s %s", g.ID, g.Proto, portrange.Format(g.PortFrom, g.PortTo))
	}
	return dg.String()
}
