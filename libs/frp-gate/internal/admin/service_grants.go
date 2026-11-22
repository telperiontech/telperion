package admin

import (
	"context"
	"strings"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/pattern"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/portrange"
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

// CreateGrant validates and stores a grant. Grants made here are never
// managed, even for a managed client or group: apply leaves them alone.
func (s *Service) CreateGrant(ctx context.Context, in GrantInput) (store.Grant, error) {
	g, err := s.ResolveGrant(ctx, s.Store, in)
	if err != nil {
		return g, err
	}
	if g, err = s.Store.CreateGrant(ctx, g); err != nil {
		return g, err
	}
	s.recordGrant(ctx, "grant.create", g)
	return g, nil
}

// DeleteGrant removes a grant that is not managed by the config file.
func (s *Service) DeleteGrant(ctx context.Context, id int64) error {
	g, err := s.Store.GrantByID(ctx, id)
	if err != nil {
		return err
	}
	if g.Managed {
		return ManagedError{Kind: "grant", Name: "#" + itoa(id), What: "removed"}
	}
	desc := s.grantText(ctx, g)
	if err := s.Store.DeleteGrant(ctx, id); err != nil {
		return err
	}
	s.record(ctx, "grant.delete", "#"+itoa(id), desc)
	return nil
}

func (s *Service) recordGrant(ctx context.Context, action string, g store.Grant) {
	s.record(ctx, action, "#"+itoa(g.ID), s.grantText(ctx, g))
}

// grantText describes a grant by names for the audit log.
func (s *Service) grantText(ctx context.Context, g store.Grant) string {
	w, err := s.world(ctx)
	if err != nil {
		return ""
	}
	v := w.grantView(g)
	return v.SubjectKind + " " + v.Subject + ": " + v.Target()
}

// ResolveGrant validates a grant described by names and looks the names up
// in st (the Service's store, or a transaction of it).
func (s *Service) ResolveGrant(ctx context.Context, st *store.Store, in GrantInput) (store.Grant, error) {
	var g store.Grant
	in.Client, in.Group = strings.TrimSpace(in.Client), strings.TrimSpace(in.Group)
	switch {
	case in.Client != "" && in.Group != "":
		return g, badInput("set client or group, not both")
	case in.Client != "":
		c, err := st.ClientByName(ctx, strings.ToLower(in.Client))
		if err != nil {
			return g, notFoundAsInput(err, "client", in.Client)
		}
		g.ClientID = c.ID
	case in.Group != "":
		gr, err := st.GroupByName(ctx, strings.ToLower(in.Group))
		if err != nil {
			return g, notFoundAsInput(err, "group", in.Group)
		}
		g.GroupID = gr.ID
	default:
		return g, badInput("a grant needs a client or a group")
	}
	switch g.Kind = strings.TrimSpace(in.Kind); g.Kind {
	case store.KindHost:
		z, err := st.ZoneByDomain(ctx, strings.ToLower(strings.TrimSpace(in.Zone)))
		if err != nil {
			return g, notFoundAsInput(err, "zone", in.Zone)
		}
		full, err := fullPattern(in.Pattern, z.Domain)
		if err != nil {
			return g, inputError{err.Error()}
		}
		g.ZoneID, g.Pattern = z.ID, full
	case store.KindPort:
		inst, err := st.InstanceByName(ctx, strings.ToLower(strings.TrimSpace(in.Instance)))
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
	return g, nil
}

// fullPattern accepts a pattern relative to the zone ("*.{client}", "@" for
// the zone itself) or a full pattern inside the zone.
func fullPattern(raw, zone string) (string, error) { return pattern.InZone(raw, zone) }

func parsePorts(s string) (int, int, error) { return portrange.Parse(s) }
