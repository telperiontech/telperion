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

// newFixture: zone dev.example.com on frps "main"; group "videochat" with
// *.{client}.dev.example.com; members sahin and ertan; home-pi has a direct
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

	for _, n := range []string{"sahin", "ertan", "home-pi", "outsider"} {
		tok := token.New(token.ClientPrefix)
		c := must(st.CreateClient(f.ctx, n, token.Hash(tok), ""))
		f.tokens[n], f.ids[n] = tok, c.ID
	}
	g := must(st.CreateGroup(f.ctx, "videochat"))
	check(t, st.AddMember(f.ctx, g.ID, f.ids["sahin"]))
	check(t, st.AddMember(f.ctx, g.ID, f.ids["ertan"]))
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
	expect(t, "member", f.login("sahin"), true, "")
	expect(t, "port-only client", f.login("home-pi"), true, "")
	expect(t, "grants only on another frps", f.login("outsider"), false, "no grants on this server")

	bad := f.user("sahin")
	bad.Metas = map[string]string{MetaToken: f.tokens["ertan"]}
	d := f.p.Login(f.ctx, f.inst, &plugin.LoginContent{Login: msg.Login{User: "sahin", Metas: bad.Metas}})
	expect(t, "someone else's token", d, false, "invalid token")
	d = f.p.Login(f.ctx, f.inst, &plugin.LoginContent{Login: msg.Login{User: "nobody", Metas: bad.Metas}})
	expect(t, "unknown user", d, false, "invalid token")
	d = f.p.Login(f.ctx, f.inst, &plugin.LoginContent{Login: msg.Login{User: "sahin"}})
	expect(t, "no token", d, false, "metadatas.token")
	d = f.p.Login(f.ctx, f.inst, &plugin.LoginContent{Login: msg.Login{Metas: bad.Metas}})
	expect(t, "no user", d, false, `"user"`)

	check(t, f.st.SetClientDisabled(f.ctx, f.ids["sahin"], true))
	expect(t, "disabled", f.login("sahin"), false, "disabled")

	c := must(f.st.ClientByID(f.ctx, f.ids["home-pi"]))
	if c.LastLoginAddr != "1.2.3.4:5" {
		t.Errorf("login address not recorded: %+v", c)
	}
}

func TestNewProxyHosts(t *testing.T) {
	f := newFixture(t)
	expect(t, "own name", f.newProxy("sahin", httpProxy("app.pc.sahin.dev.example.com")), true, "")
	expect(t, "own name, upper case", f.newProxy("sahin", httpProxy("API.sahin.dev.example.com")), true, "")
	expect(t, "own wildcard", f.newProxy("sahin", httpProxy("*.pc.sahin.dev.example.com")), true, "")
	expect(t, "foreign name", f.newProxy("sahin", httpProxy("app.ertan.dev.example.com")), false, "not granted")
	expect(t, "one of two foreign", f.newProxy("sahin", httpProxy("a.sahin.dev.example.com", "a.ertan.dev.example.com")), false, "a.ertan")
	expect(t, "zone wildcard", f.newProxy("sahin", httpProxy("*.dev.example.com")), false, "not granted")
	expect(t, "label itself", f.newProxy("sahin", httpProxy("sahin.dev.example.com")), false, "not granted")
	expect(t, "zone of another frps", f.newProxy("outsider", httpProxy("x.other.example.com")), false, "not granted")
	expect(t, "no domains", f.newProxy("sahin", msg.NewProxy{ProxyName: "web", ProxyType: "http"}), false, "customDomains")
	expect(t, "subdomain", f.newProxy("sahin", msg.NewProxy{ProxyName: "web", ProxyType: "http", SubDomain: "app"}), false, "subdomain")
	expect(t, "https", f.newProxy("ertan", msg.NewProxy{ProxyName: "s", ProxyType: "https", CustomDomains: []string{"s.ertan.dev.example.com"}}), true, "")
	expect(t, "stcp", f.newProxy("sahin", msg.NewProxy{ProxyName: "s", ProxyType: "stcp"}), false, "not allowed")
	expect(t, "invalid domain", f.newProxy("sahin", httpProxy("a b.sahin.dev.example.com")), false, "invalid label")
}

func TestNewProxyPorts(t *testing.T) {
	f := newFixture(t)
	tcp := func(port int) msg.NewProxy { return msg.NewProxy{ProxyName: "mc", ProxyType: "tcp", RemotePort: port} }
	expect(t, "granted port", f.newProxy("home-pi", tcp(25565)), true, "")
	expect(t, "other port", f.newProxy("home-pi", tcp(25566)), false, "not granted")
	expect(t, "random port", f.newProxy("home-pi", tcp(0)), false, "remotePort")
	expect(t, "udp on tcp grant", f.newProxy("home-pi", msg.NewProxy{ProxyName: "u", ProxyType: "udp", RemotePort: 25565}), false, "not granted")
	expect(t, "client without port grants", f.newProxy("sahin", tcp(25565)), false, "not granted")
}

func TestRevocation(t *testing.T) {
	f := newFixture(t)
	expect(t, "proxy", f.newProxy("sahin", httpProxy("app.sahin.dev.example.com")), true, "")
	expect(t, "ping", f.ping("sahin"), true, "")
	wc := &plugin.NewWorkConnContent{User: f.user("sahin")}
	expect(t, "work conn", f.p.NewWorkConn(f.ctx, f.inst, wc), true, "")

	check(t, f.st.SetClientDisabled(f.ctx, f.ids["sahin"], true))
	expect(t, "ping after disable", f.ping("sahin"), false, "disabled")
	expect(t, "work conn after disable", f.p.NewWorkConn(f.ctx, f.inst, wc), false, "disabled")

	check(t, f.st.SetClientDisabled(f.ctx, f.ids["sahin"], false))
	check(t, f.st.SetClientToken(f.ctx, f.ids["sahin"], token.Hash("rotated")))
	expect(t, "ping with old token", f.ping("sahin"), false, "invalid token")
}

func TestPingAfterGrantRemoved(t *testing.T) {
	f := newFixture(t)
	expect(t, "proxy", f.newProxy("ertan", httpProxy("app.ertan.dev.example.com")), true, "")
	expect(t, "ping", f.ping("ertan"), true, "")
	check(t, f.st.DeleteGrant(f.ctx, f.grant.ID))
	expect(t, "ping without grant", f.ping("ertan"), false, "not granted")
	// a closed proxy no longer blocks the session
	f.p.CloseProxy(f.ctx, f.inst, &plugin.CloseProxyContent{User: f.user("ertan"), CloseProxy: msg.CloseProxy{ProxyName: "web"}})
	expect(t, "ping after close", f.ping("ertan"), true, "")
}

func TestAskClaimed(t *testing.T) {
	f := newFixture(t)
	ask := func(h string) bool { ok, _ := f.p.Ask(f.ctx, h); return ok }
	if ask("app.sahin.dev.example.com") {
		t.Error("unclaimed name approved")
	}
	f.newProxy("sahin", httpProxy("app.sahin.dev.example.com", "*.w.sahin.dev.example.com"))
	if !ask("app.sahin.dev.example.com") || !ask("APP.sahin.dev.example.com.") {
		t.Error("claimed name refused")
	}
	if !ask("x.y.w.sahin.dev.example.com") {
		t.Error("name under a claimed wildcard refused")
	}
	if ask("other.sahin.dev.example.com") || ask("app.ertan.dev.example.com") || ask("example.com") || ask("") {
		t.Error("unclaimed or foreign name approved")
	}
	f.now = f.now.Add(31 * 24 * time.Hour)
	if ask("app.sahin.dev.example.com") {
		t.Error("claim older than retention approved")
	}
	f.ping("sahin") // a live session refreshes its claims
	if !ask("app.sahin.dev.example.com") {
		t.Error("claim not refreshed by ping")
	}
	check(t, f.st.SetClientDisabled(f.ctx, f.ids["sahin"], true))
	if ask("app.sahin.dev.example.com") {
		t.Error("name of a disabled client approved")
	}
}

func TestAskGranted(t *testing.T) {
	f := newFixture(t)
	f.p.AskMode = AskGranted
	ask := func(h string) bool { ok, _ := f.p.Ask(f.ctx, h); return ok }
	if !ask("anything.sahin.dev.example.com") {
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
