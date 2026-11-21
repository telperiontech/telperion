package policy

import (
	"context"

	plugin "github.com/fatedier/frp/pkg/plugin/server"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// Ping is the revocation point for whole sessions. It refuses disabled
// clients and sessions holding a proxy whose grant was removed. frpc closes
// the session when its Pong carries an error; frps closes it by itself once
// transport.heartbeatTimeout passes without an accepted Ping.
func (p *Policy) Ping(ctx context.Context, inst store.Instance, in *plugin.PingContent) Decision {
	c, d := p.authenticate(ctx, in.User.User, in.User.Metas)
	if !d.Allow {
		return d
	}
	runID := in.User.RunID
	if runID == "" {
		return allow()
	}
	grants, err := p.grantsOn(ctx, inst, c)
	if err != nil {
		p.Log.Error("grant lookup failed", "err", err)
		return deny("internal error")
	}
	proxies, err := p.Store.SessionProxies(ctx, inst.ID, runID)
	if err != nil {
		p.Log.Error("proxy lookup failed", "err", err)
		return deny("internal error")
	}
	var claimed []string
	for _, px := range proxies {
		if d := recheckProxy(c, grants, px); !d.Allow {
			return d
		}
		claimed = append(claimed, px.Domains...)
	}
	if err := p.Store.TouchSession(ctx, inst.ID, runID, c.ID); err != nil {
		p.Log.Warn("touch session failed", "err", err)
	}
	if err := p.Store.TouchClaims(ctx, c.ID, claimed); err != nil {
		p.Log.Warn("record claims failed", "err", err)
	}
	return allow()
}
