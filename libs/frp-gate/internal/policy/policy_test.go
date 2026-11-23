package policy

import (
	"context"
	"io"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/fatedier/frp/pkg/msg"
	plugin "github.com/fatedier/frp/pkg/plugin/server"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/token"
)

type fixture struct {
	t      *testing.T
	ctx    context.Context
	st     *store.Store
	p      *Policy
	now    time.Time
	inst   store.Instance
	other  store.Instance
	tokens map[string]string
	ids    map[string]int64
	grant  store.Grant // the group host grant
}

// newFixture: zone dev.example.com on frps "main"; group "webapp" with
// *.{client}.dev.example.com; members alice and bob; home-pi has a direct
// tcp 25565 grant on "main"; outsider has grants only on frps "other".
func newFixture(t *testing.T) *fixture {
	t.Helper()
	st, err := store.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	f := &fixture{t: t, ctx: context.Background(), st: st, now: time.Unix(1_700_000_000, 0),
		tokens: map[string]string{}, ids: map[string]int64{}}
	st.SetClock(func() time.Time { return f.now })
	f.p = New(st, AskClaimed, 30*24*time.Hour, slog.New(slog.NewTextHandler(io.Discard, nil)))
	f.p.Now = func() time.Time { return f.now }

	zone := must(st.CreateZone(f.ctx, "dev.example.com"))
	otherZone := must(st.CreateZone(f.ctx, "other.example.com"))
	f.inst = must(st.CreateInstance(f.ctx, "main", "k1", ""))
	f.other = must(st.CreateInstance(f.ctx, "other", "k2", ""))
	check(t, st.SetInstanceZones(f.ctx, f.inst.ID, []int64{zone.ID}))
	check(t, st.SetInstanceZones(f.ctx, f.other.ID, []int64{otherZone.ID}))
	f.inst = must(st.InstanceByID(f.ctx, f.inst.ID))
	f.other = must(st.InstanceByID(f.ctx, f.other.ID))

	for _, n := range []string{"alice", "bob", "home-pi", "outsider"} {
		tok := token.New(token.ClientPrefix)
		c := must(st.CreateClient(f.ctx, n, token.Hash(tok), ""))
		f.tokens[n], f.ids[n] = tok, c.ID
	}
	g := must(st.CreateGroup(f.ctx, "webapp"))
	check(t, st.AddMember(f.ctx, g.ID, f.ids["alice"]))
	check(t, st.AddMember(f.ctx, g.ID, f.ids["bob"]))
	f.grant = must(st.CreateGrant(f.ctx, store.Grant{GroupID: g.ID, Kind: store.KindHost, ZoneID: zone.ID, Pattern: "*.{client}.dev.example.com"}))
	must(st.CreateGrant(f.ctx, store.Grant{ClientID: f.ids["home-pi"], Kind: store.KindPort, InstanceID: f.inst.ID, Proto: "tcp", PortFrom: 25565, PortTo: 25565}))
	must(st.CreateGrant(f.ctx, store.Grant{ClientID: f.ids["outsider"], Kind: store.KindHost, ZoneID: otherZone.ID, Pattern: "*.other.example.com"}))
	return f
}

func must[T any](v T, err error) T {
	if err != nil {
		panic(err)
	}
	return v
}

func check(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

func (f *fixture) user(name string) plugin.UserInfo {
	return plugin.UserInfo{User: name, Metas: map[string]string{MetaToken: f.tokens[name]}, RunID: "run-" + name}
}

func (f *fixture) login(name string) Decision {
	u := f.user(name)
	return f.p.Login(f.ctx, f.inst, &plugin.LoginContent{Login: msg.Login{User: u.User, Metas: u.Metas}, ClientAddress: "1.2.3.4:5"})
}

func (f *fixture) newProxy(name string, np msg.NewProxy) Decision {
	return f.p.NewProxy(f.ctx, f.inst, &plugin.NewProxyContent{User: f.user(name), NewProxy: np})
}

func (f *fixture) ping(name string) Decision {
	return f.p.Ping(f.ctx, f.inst, &plugin.PingContent{User: f.user(name)})
}

func httpProxy(domains ...string) msg.NewProxy {
	return msg.NewProxy{ProxyName: "web", ProxyType: "http", CustomDomains: domains}
}

func expect(t *testing.T, what string, d Decision, allow bool, reason string) {
	t.Helper()
	if d.Allow != allow {
		t.Errorf("%s: allow = %v (%q), want %v", what, d.Allow, d.Reason, allow)
		return
	}
	if reason != "" && !strings.Contains(d.Reason, reason) {
		t.Errorf("%s: reason %q does not contain %q", what, d.Reason, reason)
	}
}

func TestLogin(t *testing.T) {
	f := newFixture(t)
	expect(t, "member", f.login("alice"), true, "")
	expect(t, "port-only client", f.login("home-pi"), true, "")
	expect(t, "grants only on another frps", f.login("outsider"), false, "no grants on this server")

	bad := f.user("alice")
	bad.Metas = map[string]string{MetaToken: f.tokens["bob"]}
	d := f.p.Login(f.ctx, f.inst, &plugin.LoginContent{Login: msg.Login{User: "alice", Metas: bad.Metas}})
	expect(t, "someone else's token", d, false, "invalid token")
	d = f.p.Login(f.ctx, f.inst, &plugin.LoginContent{Login: msg.Login{User: "nobody", Metas: bad.Metas}})
	expect(t, "unknown user", d, false, "invalid token")
	d = f.p.Login(f.ctx, f.inst, &plugin.LoginContent{Login: msg.Login{User: "alice"}})
	expect(t, "no token", d, false, "metadatas.token")
	d = f.p.Login(f.ctx, f.inst, &plugin.LoginContent{Login: msg.Login{Metas: bad.Metas}})
	expect(t, "no user", d, false, `"user"`)

	check(t, f.st.SetClientDisabled(f.ctx, f.ids["alice"], true))
	expect(t, "disabled", f.login("alice"), false, "disabled")

	c := must(f.st.ClientByID(f.ctx, f.ids["home-pi"]))
	if c.LastLoginAddr != "1.2.3.4:5" {
		t.Errorf("login address not recorded: %+v", c)
	}
}

func TestNewProxyHosts(t *testing.T) {
	f := newFixture(t)
	expect(t, "own name", f.newProxy("alice", httpProxy("app.pc.alice.dev.example.com")), true, "")
	expect(t, "own name, upper case", f.newProxy("alice", httpProxy("API.alice.dev.example.com")), true, "")
	expect(t, "own wildcard", f.newProxy("alice", httpProxy("*.pc.alice.dev.example.com")), true, "")
	expect(t, "foreign name", f.newProxy("alice", httpProxy("app.bob.dev.example.com")), false, "not granted")
	expect(t, "one of two foreign", f.newProxy("alice", httpProxy("a.alice.dev.example.com", "a.bob.dev.example.com")), false, "a.bob")
	expect(t, "zone wildcard", f.newProxy("alice", httpProxy("*.dev.example.com")), false, "not granted")
	expect(t, "label itself", f.newProxy("alice", httpProxy("alice.dev.example.com")), false, "not granted")
	expect(t, "zone of another frps", f.newProxy("outsider", httpProxy("x.other.example.com")), false, "not granted")
	expect(t, "no domains", f.newProxy("alice", msg.NewProxy{ProxyName: "web", ProxyType: "http"}), false, "customDomains")
	expect(t, "subdomain", f.newProxy("alice", msg.NewProxy{ProxyName: "web", ProxyType: "http", SubDomain: "app"}), false, "subdomain")
	expect(t, "https", f.newProxy("bob", msg.NewProxy{ProxyName: "s", ProxyType: "https", CustomDomains: []string{"s.bob.dev.example.com"}}), true, "")
	expect(t, "stcp", f.newProxy("alice", msg.NewProxy{ProxyName: "s", ProxyType: "stcp"}), false, "not allowed")
	expect(t, "invalid domain", f.newProxy("alice", httpProxy("a b.alice.dev.example.com")), false, "invalid label")
}

func TestNewProxyPorts(t *testing.T) {
	f := newFixture(t)
	tcp := func(port int) msg.NewProxy { return msg.NewProxy{ProxyName: "mc", ProxyType: "tcp", RemotePort: port} }
	expect(t, "granted port", f.newProxy("home-pi", tcp(25565)), true, "")
	expect(t, "other port", f.newProxy("home-pi", tcp(25566)), false, "not granted")
	expect(t, "random port", f.newProxy("home-pi", tcp(0)), false, "remotePort")
	expect(t, "udp on tcp grant", f.newProxy("home-pi", msg.NewProxy{ProxyName: "u", ProxyType: "udp", RemotePort: 25565}), false, "not granted")
	expect(t, "client without port grants", f.newProxy("alice", tcp(25565)), false, "not granted")
}

func TestRevocation(t *testing.T) {
	f := newFixture(t)
	expect(t, "proxy", f.newProxy("alice", httpProxy("app.alice.dev.example.com")), true, "")
	expect(t, "ping", f.ping("alice"), true, "")
	wc := &plugin.NewWorkConnContent{User: f.user("alice")}
	expect(t, "work conn", f.p.NewWorkConn(f.ctx, f.inst, wc), true, "")

	check(t, f.st.SetClientDisabled(f.ctx, f.ids["alice"], true))
	expect(t, "ping after disable", f.ping("alice"), false, "disabled")
	expect(t, "work conn after disable", f.p.NewWorkConn(f.ctx, f.inst, wc), false, "disabled")

	check(t, f.st.SetClientDisabled(f.ctx, f.ids["alice"], false))
	check(t, f.st.SetClientToken(f.ctx, f.ids["alice"], token.Hash("rotated")))
	expect(t, "ping with old token", f.ping("alice"), false, "invalid token")
}

// One client, two frpc (e.g. two projects) using the same proxy name.
func TestNewProxyNameInUse(t *testing.T) {
	f := newFixture(t)
	np := msg.NewProxy{ProxyName: "alice.web-pc", ProxyType: "http", CustomDomains: []string{"pc.alice.dev.example.com"}}
	second := f.user("alice")
	second.RunID = "run-alice-2"
	newProxy2 := func(np msg.NewProxy) Decision {
		return f.p.NewProxy(f.ctx, f.inst, &plugin.NewProxyContent{User: second, NewProxy: np})
	}

	expect(t, "first frpc", f.newProxy("alice", np), true, "")
	expect(t, "first frpc again (reconnect, same run id)", f.newProxy("alice", np), true, "")
	expect(t, "second frpc, same name", newProxy2(np), false, `already open in another frpc session (run id run-alice)`)
	if ps := must(f.st.SessionProxies(f.ctx, f.inst.ID, "run-alice")); len(ps) != 1 {
		t.Errorf("the name should stay recorded for the first session, got %+v", ps)
	}
	other := np
	other.ProxyName = "alice.project2-web-pc"
	other.CustomDomains = []string{"pc.alice.dev.example.com"}
	expect(t, "second frpc, own name", newProxy2(other), true, "")

	// the first session stops sending heartbeats (its CloseProxy was missed)
	f.now = f.now.Add(f.p.SessionTimeout + time.Second)
	expect(t, "name held by a dead session", newProxy2(np), true, "")
	if ps := must(f.st.SessionProxies(f.ctx, f.inst.ID, "run-alice-2")); len(ps) != 2 {
		t.Errorf("the name should now belong to the second session, got %+v", ps)
	}

	// after CloseProxy the name is free right away
	f.p.CloseProxy(f.ctx, f.inst, &plugin.CloseProxyContent{User: second, CloseProxy: msg.CloseProxy{ProxyName: np.ProxyName}})
	expect(t, "name after close", f.newProxy("alice", np), true, "")
}

func TestPingAfterGrantRemoved(t *testing.T) {
	f := newFixture(t)
	expect(t, "proxy", f.newProxy("bob", httpProxy("app.bob.dev.example.com")), true, "")
	expect(t, "ping", f.ping("bob"), true, "")
	check(t, f.st.DeleteGrant(f.ctx, f.grant.ID))
	expect(t, "ping without grant", f.ping("bob"), false, "not granted")
	// a closed proxy no longer blocks the session
	f.p.CloseProxy(f.ctx, f.inst, &plugin.CloseProxyContent{User: f.user("bob"), CloseProxy: msg.CloseProxy{ProxyName: "web"}})
	expect(t, "ping after close", f.ping("bob"), true, "")
}

func TestAskClaimed(t *testing.T) {
	f := newFixture(t)
	ask := func(h string) bool { return f.p.Ask(f.ctx, h).Allow }
	if ask("app.alice.dev.example.com") {
		t.Error("unclaimed name approved")
	}
	f.newProxy("alice", httpProxy("app.alice.dev.example.com", "*.w.alice.dev.example.com"))
	if !ask("app.alice.dev.example.com") || !ask("APP.alice.dev.example.com.") {
		t.Error("claimed name refused")
	}
	if !ask("x.y.w.alice.dev.example.com") {
		t.Error("name under a claimed wildcard refused")
	}
	if ask("other.alice.dev.example.com") || ask("app.bob.dev.example.com") || ask("example.com") || ask("") {
		t.Error("unclaimed or foreign name approved")
	}
	f.now = f.now.Add(31 * 24 * time.Hour)
	if ask("app.alice.dev.example.com") {
		t.Error("claim older than retention approved")
	}
	f.ping("alice") // a live session refreshes its claims
	if !ask("app.alice.dev.example.com") {
		t.Error("claim not refreshed by ping")
	}
	check(t, f.st.SetClientDisabled(f.ctx, f.ids["alice"], true))
	if ask("app.alice.dev.example.com") {
		t.Error("name of a disabled client approved")
	}
}

func TestAskGranted(t *testing.T) {
	f := newFixture(t)
	f.p.AskMode = AskGranted
	ask := func(h string) bool { return f.p.Ask(f.ctx, h).Allow }
	if !ask("anything.alice.dev.example.com") {
		t.Error("granted name refused")
	}
	if ask("x.nobody.dev.example.com") {
		t.Error("name of an unknown client approved")
	}
	if ask("x.home-pi.dev.example.com") {
		t.Error("name of a non-member approved")
	}
	if !ask("x.other.example.com") {
		t.Error("direct grant without placeholder refused")
	}
	check(t, f.st.SetClientDisabled(f.ctx, f.ids["outsider"], true))
	if ask("x.other.example.com") {
		t.Error("direct grant of a disabled client approved")
	}
}
