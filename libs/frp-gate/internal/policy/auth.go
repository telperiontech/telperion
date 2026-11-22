package policy

import (
	"context"
	"errors"
	"slices"

	plugin "github.com/fatedier/frp/pkg/plugin/server"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/token"
)

// MetaToken is the frpc metadatas key that carries the client token.
const MetaToken = "token"

// authenticate checks the frpc user and token on every operation, so a
// disabled or deleted client is refused at its next Ping or work connection.
func (p *Policy) authenticate(ctx context.Context, user string, metas map[string]string) (store.Client, Decision) {
	if user == "" {
		return store.Client{}, deny("missing_user", `frpc "user" must be set to the client name`)
	}
	secret := metas[MetaToken]
	if secret == "" {
		return store.Client{}, deny("missing_token", `frpc "metadatas.token" must be set to the client token`)
	}
	c, err := p.Store.ClientByName(ctx, user)
	if errors.Is(err, store.ErrNotFound) || (err == nil && !token.Equal(secret, c.TokenHash)) {
		return store.Client{}, deny("bad_token", "unknown client or invalid token")
	}
	if err != nil {
		p.Log.Error("client lookup failed", "err", err)
		return store.Client{}, deny("internal", "internal error")
	}
	if c.Disabled {
		return store.Client{}, deny("disabled", "client %q is disabled", c.Name)
	}
	return c, allow()
}

// grantsOn returns the client's grants that apply to an frps: host grants in
// zones it serves and port grants on it.
func (p *Policy) grantsOn(ctx context.Context, inst store.Instance, c store.Client) ([]store.Grant, error) {
	all, err := p.Store.EffectiveGrants(ctx, c.ID)
	if err != nil {
		return nil, err
	}
	var out []store.Grant
	for _, g := range all {
		switch g.Kind {
		case store.KindHost:
			if slices.Contains(inst.ZoneIDs, g.ZoneID) {
				out = append(out, g)
			}
		case store.KindPort:
			if g.InstanceID == inst.ID {
				out = append(out, g)
			}
		}
	}
	return out, nil
}

// Login admits a client that has at least one grant on this frps.
func (p *Policy) Login(ctx context.Context, inst store.Instance, in *plugin.LoginContent) Decision {
	c, d := p.authenticate(ctx, in.User, in.Metas)
	if !d.Allow {
		return d
	}
	grants, err := p.grantsOn(ctx, inst, c)
	if err != nil {
		p.Log.Error("grant lookup failed", "err", err)
		return deny("internal", "internal error")
	}
	if len(grants) == 0 {
		return deny("no_grants", "client %q has no grants on this server", c.Name)
	}
	if err := p.Store.RecordLogin(ctx, c.ID, in.ClientAddress, in.Version, in.Hostname); err != nil {
		p.Log.Warn("record login failed", "err", err)
	}
	if in.RunID != "" {
		if err := p.Store.TouchSession(ctx, inst.ID, in.RunID, c.ID); err != nil {
			p.Log.Warn("touch session failed", "err", err)
		}
	}
	return allow()
}

// NewWorkConn refuses work connections of disabled clients, which stops new
// traffic through their proxies immediately.
func (p *Policy) NewWorkConn(ctx context.Context, inst store.Instance, in *plugin.NewWorkConnContent) Decision {
	_, d := p.authenticate(ctx, in.User.User, in.User.Metas)
	return d
}
