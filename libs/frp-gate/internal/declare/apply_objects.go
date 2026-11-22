package declare

import (
	"fmt"
	"slices"
	"strings"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/token"
)

func (a *applier) zones() error {
	cur, err := a.st.ListZones(a.ctx)
	if err != nil {
		return err
	}
	byDomain := map[string]store.Zone{}
	for _, z := range cur {
		byDomain[z.Domain] = z
	}
	for _, domain := range a.d.Zones {
		if z, ok := byDomain[domain]; ok {
			a.zoneID[domain] = z.ID
			if err := a.adopt("zones", "zone", domain, z.ID, z.Managed); err != nil {
				return err
			}
			continue
		}
		z, err := a.st.CreateZone(a.ctx, domain)
		if err != nil {
			return err
		}
		a.zoneID[domain] = z.ID
		if err := a.st.SetManaged(a.ctx, "zones", z.ID, true); err != nil {
			return err
		}
		if err := a.change(OpCreate, "zone", domain); err != nil {
			return err
		}
	}
	return nil
}

func (a *applier) instances() error {
	cur, err := a.st.ListInstances(a.ctx)
	if err != nil {
		return err
	}
	zones, err := a.zoneNames()
	if err != nil {
		return err
	}
	byName := map[string]store.Instance{}
	for _, in := range cur {
		byName[in.Name] = in
	}
	for _, di := range a.d.Instances {
		zoneIDs := make([]int64, 0, len(di.Zones))
		for _, z := range di.Zones {
			zoneIDs = append(zoneIDs, a.zoneID[z])
		}
		slices.Sort(zoneIDs)
		in, ok := byName[di.Name]
		if !ok {
			if err := a.createInstance(di, zoneIDs); err != nil {
				return err
			}
			continue
		}
		a.instanceID[di.Name] = in.ID
		if err := a.adopt("instances", "instance", di.Name, in.ID, in.Managed); err != nil {
			return err
		}
		var details []string
		if in.ServerAddr != di.ServerAddr {
			if err := a.st.SetInstanceServerAddr(a.ctx, in.ID, di.ServerAddr); err != nil {
				return err
			}
			details = append(details, fmt.Sprintf("server_addr %q → %q", in.ServerAddr, di.ServerAddr))
		}
		if di.KeyHash != "" && di.KeyHash != in.KeyHash {
			if err := a.st.SetInstanceKey(a.ctx, in.ID, di.KeyHash); err != nil {
				return conflict(err, "instance %s: its key is already used by another instance", di.Name)
			}
			details = append(details, "plugin key changed")
		}
		d, err := a.secretFlag("instances", in.ID, in.SecretManaged, di.KeyHash != "", "key")
		if err != nil {
			return err
		}
		details = append(details, d)
		have := slices.Clone(in.ZoneIDs)
		slices.Sort(have)
		if !slices.Equal(have, zoneIDs) {
			if err := a.st.SetInstanceZones(a.ctx, in.ID, zoneIDs); err != nil {
				return err
			}
			details = append(details, fmt.Sprintf("zones [%s] → [%s]", joinNames(have, zones), strings.Join(di.Zones, ", ")))
		}
		if len(nonEmpty(details)) > 0 {
			if err := a.change(OpUpdate, "instance", di.Name, details...); err != nil {
				return err
			}
		}
	}
	return nil
}

func (a *applier) createInstance(di DesiredInstance, zoneIDs []int64) error {
	hash, note := di.KeyHash, ""
	if hash == "" {
		// Never shown: the instance is unusable until its key is rotated in
		// the UI or declared in the file.
		hash = token.Hash(token.New(token.InstancePrefix))
		note = "no key declared: rotate it in the UI or set key_env / key_file"
	}
	in, err := a.st.CreateInstance(a.ctx, di.Name, hash, di.ServerAddr)
	if err != nil {
		return conflict(err, "instance %s: its key is already used by another instance", di.Name)
	}
	a.instanceID[di.Name] = in.ID
	if err := a.st.SetManaged(a.ctx, "instances", in.ID, true); err != nil {
		return err
	}
	if err := a.st.SetSecretManaged(a.ctx, "instances", in.ID, di.KeyHash != ""); err != nil {
		return err
	}
	if err := a.st.SetInstanceZones(a.ctx, in.ID, zoneIDs); err != nil {
		return err
	}
	return a.change(OpCreate, "instance", di.Name, "zones ["+strings.Join(di.Zones, ", ")+"]", note)
}

// secretFlag records whether a token/key comes from the file.
func (a *applier) secretFlag(table string, id int64, have, want bool, what string) (string, error) {
	if have == want {
		return "", nil
	}
	if err := a.st.SetSecretManaged(a.ctx, table, id, want); err != nil {
		return "", err
	}
	if want {
		return what + " now from the file", nil
	}
	return what + " no longer from the file (it is kept; rotate it in the UI)", nil
}

func (a *applier) groups() error {
	cur, err := a.st.ListGroups(a.ctx)
	if err != nil {
		return err
	}
	byName := map[string]store.Group{}
	for _, g := range cur {
		byName[g.Name] = g
	}
	for _, name := range a.d.Groups {
		if g, ok := byName[name]; ok {
			a.groupID[name] = g.ID
			if err := a.adopt("client_groups", "group", name, g.ID, g.Managed); err != nil {
				return err
			}
			continue
		}
		g, err := a.st.CreateGroup(a.ctx, name)
		if err != nil {
			return err
		}
		a.groupID[name] = g.ID
		if err := a.st.SetManaged(a.ctx, "client_groups", g.ID, true); err != nil {
			return err
		}
		if err := a.change(OpCreate, "group", name); err != nil {
			return err
		}
	}
	return nil
}

func (a *applier) clients() error {
	cur, err := a.st.ListClients(a.ctx)
	if err != nil {
		return err
	}
	byName := map[string]store.Client{}
	for _, c := range cur {
		byName[c.Name] = c
	}
	for _, dc := range a.d.Clients {
		c, ok := byName[dc.Name]
		if !ok {
			if err := a.createClient(dc); err != nil {
				return err
			}
			continue
		}
		a.clientID[dc.Name] = c.ID
		if err := a.adopt("clients", "client", dc.Name, c.ID, c.Managed); err != nil {
			return err
		}
		var details []string
		if c.Note != dc.Note {
			if err := a.st.SetClientNote(a.ctx, c.ID, dc.Note); err != nil {
				return err
			}
			details = append(details, fmt.Sprintf("note %q → %q", c.Note, dc.Note))
		}
		if dc.TokenHash != "" && dc.TokenHash != c.TokenHash {
			if err := a.st.SetClientToken(a.ctx, c.ID, dc.TokenHash); err != nil {
				return conflict(err, "client %s: its token is already used by another client", dc.Name)
			}
			details = append(details, "token changed")
		}
		d, err := a.secretFlag("clients", c.ID, c.SecretManaged, dc.TokenHash != "", "token")
		if err != nil {
			return err
		}
		details = append(details, d)
		if dc.Disabled != nil && *dc.Disabled != c.Disabled {
			if err := a.st.SetClientDisabled(a.ctx, c.ID, *dc.Disabled); err != nil {
				return err
			}
			details = append(details, fmt.Sprintf("disabled %t → %t", c.Disabled, *dc.Disabled))
		}
		if len(nonEmpty(details)) > 0 {
			if err := a.change(OpUpdate, "client", dc.Name, details...); err != nil {
				return err
			}
		}
	}
	return nil
}

func (a *applier) createClient(dc DesiredClient) error {
	hash, note := dc.TokenHash, ""
	if hash == "" {
		hash = token.Hash(token.New(token.ClientPrefix))
		note = "no token declared: rotate it in the UI to get one"
	}
	c, err := a.st.CreateClient(a.ctx, dc.Name, hash, dc.Note)
	if err != nil {
		return conflict(err, "client %s: its token is already used by another client", dc.Name)
	}
	a.clientID[dc.Name] = c.ID
	if err := a.st.SetManaged(a.ctx, "clients", c.ID, true); err != nil {
		return err
	}
	if err := a.st.SetSecretManaged(a.ctx, "clients", c.ID, dc.TokenHash != ""); err != nil {
		return err
	}
	disabled := ""
	if dc.Disabled != nil && *dc.Disabled {
		if err := a.st.SetClientDisabled(a.ctx, c.ID, true); err != nil {
			return err
		}
		disabled = "disabled"
	}
	return a.change(OpCreate, "client", dc.Name, disabled, note)
}

// members makes each managed group's members exactly the clients that list
// it. Memberships in groups made in the UI are left alone.
func (a *applier) members() error {
	cur, err := a.st.ListGroups(a.ctx)
	if err != nil {
		return err
	}
	clients, err := a.clientNames()
	if err != nil {
		return err
	}
	have := map[string][]int64{}
	for _, g := range cur {
		have[g.Name] = g.MemberIDs
	}
	for _, name := range a.d.Groups {
		gid := a.groupID[name]
		var want []int64
		for _, dc := range a.d.Clients {
			if slices.Contains(dc.Groups, name) {
				want = append(want, a.clientID[dc.Name])
			}
		}
		var details []string
		for _, id := range want {
			if !slices.Contains(have[name], id) {
				if err := a.st.AddMember(a.ctx, gid, id); err != nil {
					return err
				}
				details = append(details, "+ member "+clients[id])
			}
		}
		for _, id := range have[name] {
			if !slices.Contains(want, id) {
				if err := a.st.RemoveMember(a.ctx, gid, id); err != nil {
					return err
				}
				details = append(details, "- member "+clients[id])
			}
		}
		if len(details) > 0 {
			if err := a.change(OpUpdate, "group", name, details...); err != nil {
				return err
			}
		}
	}
	return nil
}

func (a *applier) zoneNames() (map[int64]string, error) {
	zs, err := a.st.ListZones(a.ctx)
	out := map[int64]string{}
	for _, z := range zs {
		out[z.ID] = z.Domain
	}
	return out, err
}

func (a *applier) clientNames() (map[int64]string, error) {
	cs, err := a.st.ListClients(a.ctx)
	out := map[int64]string{}
	for _, c := range cs {
		out[c.ID] = c.Name
	}
	return out, err
}

func joinNames(ids []int64, names map[int64]string) string {
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		out = append(out, names[id])
	}
	return strings.Join(out, ", ")
}
