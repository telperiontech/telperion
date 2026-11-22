package policy

import (
	"context"

	"github.com/fatedier/frp/pkg/msg"
	plugin "github.com/fatedier/frp/pkg/plugin/server"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/names"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/pattern"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// NewProxy admits a proxy only if every name or port it claims is granted.
func (p *Policy) NewProxy(ctx context.Context, inst store.Instance, in *plugin.NewProxyContent) Decision {
	c, d := p.authenticate(ctx, in.User.User, in.User.Metas)
	if !d.Allow {
		return d
	}
	grants, err := p.grantsOn(ctx, inst, c)
	if err != nil {
		p.Log.Error("grant lookup failed", "err", err)
		return deny("internal", "internal error")
	}
	px, d := checkProxy(c, grants, &in.NewProxy)
	if !d.Allow {
		return d
	}
	if in.User.RunID != "" {
		if err := p.Store.TouchSession(ctx, inst.ID, in.User.RunID, c.ID); err != nil {
			p.Log.Warn("touch session failed", "err", err)
		} else if err := p.Store.AddProxy(ctx, inst.ID, in.User.RunID, px); err != nil {
			p.Log.Warn("record proxy failed", "err", err)
		}
	}
	if err := p.Store.TouchClaims(ctx, c.ID, px.Domains); err != nil {
		p.Log.Warn("record claims failed", "err", err)
	}
	return allow()
}

// CloseProxy forgets a proxy. It is a notification; frps ignores the answer.
func (p *Policy) CloseProxy(ctx context.Context, inst store.Instance, in *plugin.CloseProxyContent) Decision {
	if err := p.Store.RemoveProxy(ctx, inst.ID, in.ProxyName); err != nil {
		p.Log.Warn("remove proxy failed", "err", err)
	}
	return allow()
}

// checkProxy validates a NewProxy message against grants and returns the
// normalised proxy to record.
func checkProxy(c store.Client, grants []store.Grant, np *msg.NewProxy) (store.Proxy, Decision) {
	px := store.Proxy{Name: np.ProxyName, Type: np.ProxyType}
	switch np.ProxyType {
	case "http", "https", "tcpmux":
		if np.SubDomain != "" {
			return px, deny("subdomain", "proxy %q: subdomain is not supported, use customDomains with the full name", np.ProxyName)
		}
		if len(np.CustomDomains) == 0 {
			return px, deny("no_domains", "proxy %q: customDomains is required", np.ProxyName)
		}
		for _, raw := range np.CustomDomains {
			host, err := names.Domain(raw, true)
			if err != nil {
				return px, deny("bad_name", "proxy %q: %v", np.ProxyName, err)
			}
			if !hostAllowed(c, grants, host) {
				return px, deny("host_not_granted", "proxy %q: %s is not granted to client %q", np.ProxyName, host, c.Name)
			}
			px.Domains = append(px.Domains, host)
		}
	case "tcp", "udp":
		if np.RemotePort == 0 {
			return px, deny("port_unset", "proxy %q: remotePort must be set explicitly", np.ProxyName)
		}
		if !portAllowed(grants, np.ProxyType, np.RemotePort) {
			return px, deny("port_not_granted", "proxy %q: %s port %d is not granted to client %q", np.ProxyName, np.ProxyType, np.RemotePort, c.Name)
		}
		px.RemotePort = np.RemotePort
	default:
		return px, deny("type_not_allowed", "proxy %q: type %q is not allowed by frp-gate", np.ProxyName, np.ProxyType)
	}
	return px, allow()
}

// recheckProxy reports whether a recorded proxy is still covered by grants.
func recheckProxy(c store.Client, grants []store.Grant, px store.Proxy) Decision {
	np := msg.NewProxy{ProxyName: px.Name, ProxyType: px.Type, CustomDomains: px.Domains, RemotePort: px.RemotePort}
	_, d := checkProxy(c, grants, &np)
	return d
}

func hostAllowed(c store.Client, grants []store.Grant, host string) bool {
	for _, g := range grants {
		if g.Kind != store.KindHost {
			continue
		}
		pat, err := pattern.Parse(g.Pattern)
		if err != nil {
			continue
		}
		if pat.Covers(host, c.Name) {
			return true
		}
	}
	return false
}

func portAllowed(grants []store.Grant, proto string, port int) bool {
	for _, g := range grants {
		if g.Kind == store.KindPort && g.Proto == proto && port >= g.PortFrom && port <= g.PortTo {
			return true
		}
	}
	return false
}
