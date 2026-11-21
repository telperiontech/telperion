package policy

import (
	"context"
	"errors"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/names"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/pattern"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// Ask decides whether Caddy may obtain a certificate for host.
func (p *Policy) Ask(ctx context.Context, host string) (bool, string) {
	h, err := names.Domain(host, false)
	if err != nil {
		return false, err.Error()
	}
	owners, err := p.grantees(ctx, h)
	if err != nil {
		p.Log.Error("ask: grant lookup failed", "err", err)
		return false, "internal error"
	}
	if len(owners) == 0 {
		return false, "not granted to any enabled client"
	}
	if p.AskMode == AskGranted {
		return true, ""
	}
	since := p.Now().Add(-p.ClaimRetention)
	claimants, err := p.Store.ClaimantsOf(ctx, append([]string{h}, names.WildcardParents(h)...), since)
	if err != nil {
		p.Log.Error("ask: claim lookup failed", "err", err)
		return false, "internal error"
	}
	for _, id := range claimants {
		if owners[id] {
			return true, ""
		}
	}
	return false, "granted but not used by a proxy recently"
}

// grantees returns the enabled clients whose grants cover host.
func (p *Policy) grantees(ctx context.Context, host string) (map[int64]bool, error) {
	grants, err := p.Store.HostGrants(ctx)
	if err != nil {
		return nil, err
	}
	out := map[int64]bool{}
	for _, g := range grants {
		pat, err := pattern.Parse(g.Pattern)
		if err != nil {
			continue
		}
		bound, ok := pat.Capture(host)
		if !ok {
			continue
		}
		if pat.HasPlaceholder() {
			c, err := p.Store.ClientByName(ctx, bound)
			if errors.Is(err, store.ErrNotFound) {
				continue
			}
			if err != nil {
				return nil, err
			}
			if c.Disabled || (g.ClientID != 0 && g.ClientID != c.ID) {
				continue
			}
			if g.GroupID != 0 {
				member, err := p.Store.IsMember(ctx, g.GroupID, c.ID)
				if err != nil {
					return nil, err
				}
				if !member {
					continue
				}
			}
			out[c.ID] = true
			continue
		}
		if g.ClientID != 0 {
			c, err := p.Store.ClientByID(ctx, g.ClientID)
			if err != nil {
				return nil, err
			}
			if !c.Disabled {
				out[c.ID] = true
			}
			continue
		}
		members, err := p.Store.EnabledMembers(ctx, g.GroupID)
		if err != nil {
			return nil, err
		}
		for _, c := range members {
			out[c.ID] = true
		}
	}
	return out, nil
}
