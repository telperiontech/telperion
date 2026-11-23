package admin

import (
	"fmt"
	"net"
	"strings"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/frpplugin"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/pattern"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/policy"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// Heartbeat settings frp-gate relies on for revocation (see DESIGN.md).
const (
	HeartbeatInterval = 15 // frpc transport.heartbeatInterval
	HeartbeatTimeout  = 60 // frpc and frps transport.heartbeatTimeout
)

// frpcSnippet is a ready frpc.toml for a client. secret is the token, or ""
// to print a placeholder (the token is only known right after creation).
func frpcSnippet(w *world, c store.Client, secret string, grants []store.Grant) string {
	host, port := "frps.example.com", "7000"
	var hostExample string
	var portGrant *store.Grant
	var inst *store.Instance
	for i := range grants {
		g := grants[i]
		if g.Kind == store.KindHost && hostExample == "" {
			if p, err := pattern.Parse(g.Pattern); err == nil {
				hostExample = p.Expand(c.Name)
				if p.Wildcard() {
					hostExample = "app" + strings.TrimPrefix(hostExample, "*")
				}
			}
			for _, in := range w.Instances {
				for _, z := range in.ZoneIDs {
					if z == g.ZoneID && inst == nil {
						inst = &in
					}
				}
			}
		}
		if g.Kind == store.KindPort && portGrant == nil {
			portGrant = &g
			if inst == nil {
				in := w.instances[g.InstanceID]
				inst = &in
			}
		}
	}
	if inst != nil && inst.ServerAddr != "" {
		if h, p, err := net.SplitHostPort(inst.ServerAddr); err == nil {
			host, port = h, p
		} else {
			host = inst.ServerAddr
		}
	}
	if secret == "" {
		secret = "<the token shown when the client was created or rotated>"
	}
	var b strings.Builder
	fmt.Fprintf(&b, "serverAddr = %q\nserverPort = %s\n", host, port)
	fmt.Fprintf(&b, "user = %q\nmetadatas.%s = %q\n\n", c.Name, policy.MetaToken, secret)
	b.WriteString("# frp-gate cuts off revoked clients through heartbeats. Keep these;\n")
	b.WriteString("# without them frps drops the connection after the timeout.\n")
	fmt.Fprintf(&b, "transport.heartbeatInterval = %d\ntransport.heartbeatTimeout = %d\n", HeartbeatInterval, HeartbeatTimeout)
	if hostExample != "" || portGrant != nil {
		b.WriteString("\n# Proxy names must differ across every frpc of this client (one per\n")
		b.WriteString("# project or device): name them <project>-<service>-<device>.\n")
	}
	if hostExample != "" {
		fmt.Fprintf(&b, "\n[[proxies]]\nname = \"web\"\ntype = \"http\"\nlocalPort = 3000\ncustomDomains = [%q]\n", hostExample)
	}
	if portGrant != nil {
		fmt.Fprintf(&b, "\n[[proxies]]\nname = \"%s-%d\"\ntype = %q\nlocalPort = %d\nremotePort = %d\n",
			portGrant.Proto, portGrant.PortFrom, portGrant.Proto, portGrant.PortFrom, portGrant.PortFrom)
	}
	return b.String()
}

// frpsSnippet is the part of frps.toml that wires an frps to frp-gate.
func frpsSnippet(pluginAddr, key string) string {
	ops := make([]string, len(frpplugin.Ops))
	for i, op := range frpplugin.Ops {
		ops[i] = fmt.Sprintf("%q", op)
	}
	var b strings.Builder
	b.WriteString("# frp-gate decides who may log in; do not set auth.token.\n")
	b.WriteString("# Heartbeats must run (even with tcpMux) so revoked clients are dropped.\n")
	fmt.Fprintf(&b, "transport.heartbeatTimeout = %d\n\n", HeartbeatTimeout)
	b.WriteString("[[httpPlugins]]\nname = \"frp-gate\"\n")
	fmt.Fprintf(&b, "addr = %q\npath = \"/frps/%s\"\nops = [%s]\n", pluginAddr, key, strings.Join(ops, ", "))
	return b.String()
}
