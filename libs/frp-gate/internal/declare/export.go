package declare

import (
	"cmp"
	"context"
	"slices"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/pattern"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/portrange"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// Export describes the whole database (managed objects and those made in
// the UI) as a config file. Tokens and plugin keys appear only as
// token_sha256 / key_sha256, so applying the export keeps every secret.
func Export(ctx context.Context, st *store.Store) (*File, error) {
	f := &File{Instances: map[string]InstanceSpec{}, Clients: map[string]ClientSpec{}}
	zones, err := st.ListZones(ctx)
	if err != nil {
		return nil, err
	}
	zoneName := map[int64]string{}
	for _, z := range zones {
		f.Zones = append(f.Zones, z.Domain)
		zoneName[z.ID] = z.Domain
	}
	instances, err := st.ListInstances(ctx)
	if err != nil {
		return nil, err
	}
	instName := map[int64]string{}
	for _, in := range instances {
		spec := InstanceSpec{ServerAddr: in.ServerAddr, KeySHA256: in.KeyHash}
		for _, id := range in.ZoneIDs {
			spec.Zones = append(spec.Zones, zoneName[id])
		}
		slices.Sort(spec.Zones)
		f.Instances[in.Name] = spec
		instName[in.ID] = in.Name
	}
	groups, err := st.ListGroups(ctx)
	if err != nil {
		return nil, err
	}
	groupName := map[int64]string{}
	memberOf := map[int64][]string{}
	for _, g := range groups {
		f.Groups = append(f.Groups, g.Name)
		groupName[g.ID] = g.Name
		for _, c := range g.MemberIDs {
			memberOf[c] = append(memberOf[c], g.Name)
		}
	}
	clients, err := st.ListClients(ctx)
	if err != nil {
		return nil, err
	}
	clientName := map[int64]string{}
	for _, c := range clients {
		spec := ClientSpec{Note: c.Note, TokenSHA256: c.TokenHash, Groups: memberOf[c.ID]}
		slices.Sort(spec.Groups)
		if c.Disabled {
			t := true
			spec.Disabled = &t
		}
		f.Clients[c.Name] = spec
		clientName[c.ID] = c.Name
	}
	grants, err := st.ListGrants(ctx)
	if err != nil {
		return nil, err
	}
	for _, g := range grants {
		spec := GrantSpec{Client: clientName[g.ClientID], Group: groupName[g.GroupID], Kind: g.Kind}
		if g.Kind == store.KindHost {
			spec.Zone = zoneName[g.ZoneID]
			spec.Pattern = pattern.Relative(g.Pattern, spec.Zone)
		} else {
			spec.Instance, spec.Proto = instName[g.InstanceID], g.Proto
			spec.Ports = Ports(portrange.Format(g.PortFrom, g.PortTo))
		}
		f.Grants = append(f.Grants, spec)
	}
	slices.SortStableFunc(f.Grants, func(a, b GrantSpec) int {
		return cmp.Or(cmp.Compare(a.Group, b.Group), cmp.Compare(a.Client, b.Client), cmp.Compare(a.Kind, b.Kind),
			cmp.Compare(a.Zone, b.Zone), cmp.Compare(a.Pattern, b.Pattern), cmp.Compare(a.Instance, b.Instance),
			cmp.Compare(a.Proto, b.Proto), cmp.Compare(a.Ports, b.Ports))
	})
	return f, nil
}
