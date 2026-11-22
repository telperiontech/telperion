package declare

import (
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/names"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/pattern"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/portrange"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// Desired is a validated, normalised file with secrets resolved to hashes.
// Every reference points at an object declared in the same file, so the
// file alone can rebuild a lost database.
type Desired struct {
	Zones     []string
	Instances []DesiredInstance
	Groups    []string
	Clients   []DesiredClient
	Grants    []DesiredGrant
}

// DesiredInstance is a normalised InstanceSpec.
type DesiredInstance struct {
	Name, ServerAddr string
	Zones            []string
	KeyHash          string // "" = not declared
}

// DesiredClient is a normalised ClientSpec.
type DesiredClient struct {
	Name, Note string
	Groups     []string
	Disabled   *bool
	TokenHash  string // "" = not declared
}

// DesiredGrant is a normalised GrantSpec. Pattern is the full pattern.
type DesiredGrant struct {
	Client, Group, Kind string
	Zone, Pattern       string
	Instance, Proto     string
	PortFrom, PortTo    int
}

// Subject is "client x" or "group y".
func (g DesiredGrant) Subject() string {
	if g.Client != "" {
		return "client " + g.Client
	}
	return "group " + g.Group
}

// String describes the grant by names (never secret).
func (g DesiredGrant) String() string {
	if g.Kind == store.KindHost {
		return g.Subject() + ": host " + g.Pattern
	}
	return fmt.Sprintf("%s: %s %s on %s", g.Subject(), g.Proto, portrange.Format(g.PortFrom, g.PortTo), g.Instance)
}

// Resolve validates the whole file and reads the secrets it references.
// Every problem is reported, not only the first.
func (f *File) Resolve(env Env) (*Desired, error) {
	v := validator{d: &Desired{}}
	zones := v.zones(f.Zones)
	v.groups(f.Groups)
	groups := map[string]bool{}
	for _, g := range v.d.Groups {
		groups[g] = true
	}
	instances := v.instances(env, f.Instances, zones)
	clients := v.clients(env, f.Clients, groups)
	v.grants(f.Grants, zones, instances, clients, groups)
	if len(v.errs) > 0 {
		return nil, errors.Join(v.errs...)
	}
	return v.d, nil
}

type validator struct {
	d    *Desired
	errs []error
}

func (v *validator) fail(format string, args ...any) {
	v.errs = append(v.errs, fmt.Errorf(format, args...))
}

func (v *validator) zones(in []string) map[string]bool {
	seen := map[string]bool{}
	for _, raw := range in {
		z, err := names.Domain(raw, false)
		if err != nil {
			v.fail("zones: %v", err)
			continue
		}
		if seen[z] {
			v.fail("zones: %s is listed twice", z)
			continue
		}
		seen[z] = true
		v.d.Zones = append(v.d.Zones, z)
	}
	slices.Sort(v.d.Zones)
	return seen
}

func (v *validator) groups(in []string) {
	seen := map[string]bool{}
	for _, raw := range in {
		g, err := names.Label("group", raw)
		if err != nil {
			v.fail("groups: %v", err)
			continue
		}
		if seen[g] {
			v.fail("groups: %s is listed twice", g)
			continue
		}
		seen[g] = true
		v.d.Groups = append(v.d.Groups, g)
	}
	slices.Sort(v.d.Groups)
}

// refs normalises a list of names that must be declared in the file.
func (v *validator) refs(where, kind string, in []string, declared map[string]bool, norm func(string) string) []string {
	out := []string{}
	for _, raw := range in {
		n := norm(raw)
		switch {
		case !declared[n]:
			v.fail("%s: %s %q is not declared in this file", where, kind, raw)
		case slices.Contains(out, n):
			v.fail("%s: %s %s is listed twice", where, kind, n)
		default:
			out = append(out, n)
		}
	}
	slices.Sort(out)
	return out
}

func lower(s string) string { return strings.ToLower(strings.TrimSpace(strings.TrimSuffix(s, "."))) }

func (v *validator) instances(env Env, in map[string]InstanceSpec, zones map[string]bool) map[string]bool {
	seen := map[string]bool{}
	for _, raw := range sortedKeys(in) {
		spec := in[raw]
		name, err := names.Label("instance", raw)
		if err != nil {
			v.fail("instances: %v", err)
			continue
		}
		if seen[name] {
			v.fail("instances: %s is declared twice", name)
			continue
		}
		seen[name] = true
		where := "instance " + name
		hash, err := secretHash(env, where+" key", spec.KeyEnv, spec.KeyFile, spec.KeySHA256)
		if err != nil {
			v.errs = append(v.errs, err)
		}
		v.d.Instances = append(v.d.Instances, DesiredInstance{
			Name: name, ServerAddr: strings.TrimSpace(spec.ServerAddr),
			Zones: v.refs(where, "zone", spec.Zones, zones, lower), KeyHash: hash,
		})
	}
	v.unique("instance key", func(yield func(string, string)) {
		for _, in := range v.d.Instances {
			yield(in.Name, in.KeyHash)
		}
	})
	return seen
}

func (v *validator) clients(env Env, in map[string]ClientSpec, groups map[string]bool) map[string]bool {
	seen := map[string]bool{}
	for _, raw := range sortedKeys(in) {
		spec := in[raw]
		name, err := names.Label("client", raw)
		if err != nil {
			v.fail("clients: %v", err)
			continue
		}
		if seen[name] {
			v.fail("clients: %s is declared twice", name)
			continue
		}
		seen[name] = true
		where := "client " + name
		hash, err := secretHash(env, where+" token", spec.TokenEnv, spec.TokenFile, spec.TokenSHA256)
		if err != nil {
			v.errs = append(v.errs, err)
		}
		v.d.Clients = append(v.d.Clients, DesiredClient{
			Name: name, Note: strings.TrimSpace(spec.Note), Disabled: spec.Disabled, TokenHash: hash,
			Groups: v.refs(where, "group", spec.Groups, groups, lower),
		})
	}
	v.unique("token", func(yield func(string, string)) {
		for _, c := range v.d.Clients {
			yield(c.Name, c.TokenHash)
		}
	})
	return seen
}

// unique reports two objects declaring the same secret.
func (v *validator) unique(what string, each func(yield func(name, hash string))) {
	owner := map[string]string{}
	each(func(name, hash string) {
		if hash == "" {
			return
		}
		if other, ok := owner[hash]; ok {
			v.fail("%s and %s use the same %s", other, name, what)
			return
		}
		owner[hash] = name
	})
}

func (v *validator) grants(in []GrantSpec, zones, instances, clients, groups map[string]bool) {
	seen := map[DesiredGrant]bool{}
	for i, spec := range in {
		where := fmt.Sprintf("grants[%d]", i)
		g, ok := v.grant(where, spec, zones, instances, clients, groups)
		if !ok {
			continue
		}
		if seen[g] {
			v.fail("%s: duplicate of an earlier grant (%s)", where, g)
			continue
		}
		seen[g] = true
		v.d.Grants = append(v.d.Grants, g)
	}
}

func (v *validator) grant(where string, s GrantSpec, zones, instances, clients, groups map[string]bool) (DesiredGrant, bool) {
	errs := len(v.errs)
	g := DesiredGrant{Client: lower(s.Client), Group: lower(s.Group), Kind: strings.TrimSpace(s.Kind)}
	switch {
	case g.Client != "" && g.Group != "":
		v.fail("%s: set client or group, not both", where)
	case g.Client != "" && !clients[g.Client]:
		v.fail("%s: client %q is not declared in this file", where, s.Client)
	case g.Group != "" && !groups[g.Group]:
		v.fail("%s: group %q is not declared in this file", where, s.Group)
	case g.Client == "" && g.Group == "":
		v.fail("%s: a grant needs a client or a group", where)
	}
	switch g.Kind {
	case store.KindHost:
		if s.Instance != "" || s.Proto != "" || s.Ports != "" {
			v.fail("%s: instance, proto and ports are only for port grants", where)
		}
		g.Zone = lower(s.Zone)
		if !zones[g.Zone] {
			v.fail("%s: zone %q is not declared in this file", where, s.Zone)
			break
		}
		full, err := pattern.InZone(s.Pattern, g.Zone)
		if err != nil {
			v.fail("%s: %v", where, err)
		}
		g.Pattern = full
	case store.KindPort:
		if s.Zone != "" || s.Pattern != "" {
			v.fail("%s: zone and pattern are only for host grants", where)
		}
		g.Instance = lower(s.Instance)
		if !instances[g.Instance] {
			v.fail("%s: instance %q is not declared in this file", where, s.Instance)
		}
		g.Proto = lower(s.Proto)
		if g.Proto != "tcp" && g.Proto != "udp" {
			v.fail("%s: proto must be tcp or udp", where)
		}
		var err error
		if g.PortFrom, g.PortTo, err = portrange.Parse(string(s.Ports)); err != nil {
			v.fail("%s: %v", where, err)
		}
	default:
		v.fail("%s: kind must be host or port", where)
	}
	return g, len(v.errs) == errs
}

func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	slices.Sort(keys)
	return keys
}
