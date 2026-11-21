package admin

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/pattern"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// GrantInput describes a grant by names. Set Client or Group.
// Host grants: Zone + Pattern (relative to the zone like "*.{client}", or
// the full pattern). Port grants: Instance + Proto + Ports ("25565" or "6000-6010").
type GrantInput struct {
	Client   string `json:"client"`
	Group    string `json:"group"`
	Kind     string `json:"kind"`
	Zone     string `json:"zone"`
	Pattern  string `json:"pattern"`
	Instance string `json:"instance"`
	Proto    string `json:"proto"`
	Ports    string `json:"ports"`
}

// CreateGrant validates and stores a grant.
func (s *Service) CreateGrant(ctx context.Context, in GrantInput) (store.Grant, error) {
	var g store.Grant
	in.Client, in.Group = strings.TrimSpace(in.Client), strings.TrimSpace(in.Group)
	switch {
	case in.Client != "" && in.Group != "":
		return g, badInput("set client or group, not both")
	case in.Client != "":
		c, err := s.Client(ctx, in.Client)
		if err != nil {
			return g, notFoundAsInput(err, "client", in.Client)
		}
		g.ClientID = c.ID
	case in.Group != "":
		gr, err := s.Store.GroupByName(ctx, strings.ToLower(in.Group))
		if err != nil {
			return g, notFoundAsInput(err, "group", in.Group)
		}
		g.GroupID = gr.ID
	default:
		return g, badInput("a grant needs a client or a group")
	}
	switch g.Kind = strings.TrimSpace(in.Kind); g.Kind {
	case store.KindHost:
		z, err := s.Store.ZoneByDomain(ctx, strings.ToLower(strings.TrimSpace(in.Zone)))
		if err != nil {
			return g, notFoundAsInput(err, "zone", in.Zone)
		}
		full, err := fullPattern(in.Pattern, z.Domain)
		if err != nil {
			return g, inputError{err.Error()}
		}
		g.ZoneID, g.Pattern = z.ID, full
	case store.KindPort:
		inst, err := s.Instance(ctx, in.Instance)
		if err != nil {
			return g, notFoundAsInput(err, "instance", in.Instance)
		}
		g.InstanceID = inst.ID
		g.Proto = strings.ToLower(strings.TrimSpace(in.Proto))
		if g.Proto != "tcp" && g.Proto != "udp" {
			return g, badInput("proto must be tcp or udp")
		}
		if g.PortFrom, g.PortTo, err = parsePorts(in.Ports); err != nil {
			return g, inputError{err.Error()}
		}
	default:
		return g, badInput("kind must be host or port")
	}
	return s.Store.CreateGrant(ctx, g)
}

// fullPattern accepts a pattern relative to the zone ("*.{client}", "@" for
// the zone itself) or a full pattern inside the zone.
func fullPattern(raw, zone string) (string, error) {
	raw = strings.TrimSuffix(strings.ToLower(strings.TrimSpace(raw)), ".")
	switch {
	case raw == "" || raw == "@":
		raw = zone
	case raw != zone && !strings.HasSuffix(raw, "."+zone):
		raw += "." + zone
	}
	p, err := pattern.Parse(raw)
	if err != nil {
		return "", err
	}
	if !p.Within(zone) {
		return "", fmt.Errorf("pattern %s is not inside zone %s", p, zone)
	}
	return p.String(), nil
}

func parsePorts(s string) (int, int, error) {
	s = strings.TrimSpace(s)
	from, to, found := strings.Cut(s, "-")
	a, err1 := strconv.Atoi(strings.TrimSpace(from))
	b := a
	var err2 error
	if found {
		b, err2 = strconv.Atoi(strings.TrimSpace(to))
	}
	if err1 != nil || err2 != nil || a < 1 || b > 65535 || a > b {
		return 0, 0, fmt.Errorf("ports must be a port (25565) or a range (6000-6010) within 1-65535, got %q", s)
	}
	return a, b, nil
}
