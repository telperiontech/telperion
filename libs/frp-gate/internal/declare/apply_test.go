package declare

import (
	"strings"
	"testing"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/token"
)

func TestApplyCreatesAndIsIdempotent(t *testing.T) {
	st, ctx := newStore(t)
	got := apply(t, st, ctx, homeYAML, false)
	mustContain(t, got,
		"+ zone example.org", "+ zone dev.webapp.example.net",
		"+ instance default: zones [dev.webapp.example.net, example.org]; no key declared",
		"+ group webapp", "+ client home-pi",
		"+ grant client home-pi: host *.example.org",
		"+ grant client home-pi: tcp 25565 on default",
		"+ grant group webapp: host *.{client}.dev.webapp.example.net",
	)
	c, err := st.ClientByName(ctx, "home-pi")
	if err != nil || !c.Managed || !c.SecretManaged || c.Note != "Pi frpc" || !token.Equal(piToken, c.TokenHash) {
		t.Fatalf("home-pi: %+v %v", c, err)
	}
	if again := apply(t, st, ctx, homeYAML, false); len(again) != 0 {
		t.Errorf("second apply changed something: %v", again)
	}
}

func TestApplyDryRunChangesNothing(t *testing.T) {
	st, ctx := newStore(t)
	got := apply(t, st, ctx, homeYAML, true)
	if len(got) < 8 {
		t.Fatalf("dry run should list the changes: %v", got)
	}
	if zs, _ := st.ListZones(ctx); len(zs) != 0 {
		t.Errorf("dry run created zones: %v", zs)
	}
	if es, _ := st.ListAudit(ctx, 0, 10); len(es) != 0 {
		t.Errorf("dry run wrote the audit log: %v", es)
	}
}

func TestApplyKeepsDeclaredTokenOnRebuild(t *testing.T) {
	// A lost database is rebuilt from the file with the same token: the
	// client's frpc keeps working without a new token.
	for range 2 {
		st, ctx := newStore(t)
		apply(t, st, ctx, homeYAML, false)
		c, _ := st.ClientByName(ctx, "home-pi")
		if !token.Equal(piToken, c.TokenHash) {
			t.Fatal("token changed on rebuild")
		}
	}
}

func TestApplyUpdatesAndDeletes(t *testing.T) {
	st, ctx := newStore(t)
	apply(t, st, ctx, homeYAML, false)
	const changed = `
zones: [example.org]
instances:
  default: { server_addr: gate2.example.org:7000, zones: [example.org], key_env: KEY }
clients:
  home-pi:
    note: new note
    token_env: FRP_GATE_TOKEN_HOME_PI
    disabled: true
grants:
  - { client: home-pi, kind: host, zone: example.org, pattern: "*" }
`
	got := apply(t, st, ctx, changed, false)
	mustContain(t, got,
		`~ instance default: server_addr "gate.example.org:7000" → "gate2.example.org:7000"; plugin key changed; key now from the file; zones [dev.webapp.example.net, example.org] → [example.org]`,
		`~ client home-pi: note "Pi frpc" → "new note"; disabled false → true`,
		"- grant client home-pi: tcp 25565 on default",
		"- grant group webapp: host *.{client}.dev.webapp.example.net",
		"- group webapp",
		"- zone dev.webapp.example.net",
	)
	in, _ := st.InstanceByName(ctx, "default")
	if in.KeyHash != token.Hash(keyValue) || !in.SecretManaged {
		t.Error("instance key from key_env not applied")
	}
	if gs, _ := st.ListGrants(ctx); len(gs) != 1 {
		t.Errorf("grants left: %d", len(gs))
	}
}

func TestApplyRollsBackOnFailure(t *testing.T) {
	st, ctx := newStore(t)
	apply(t, st, ctx, homeYAML, false)
	// A grant made in the UI on a managed zone blocks removing that zone.
	z, _ := st.ZoneByDomain(ctx, "dev.webapp.example.net")
	c, _ := st.ClientByName(ctx, "home-pi")
	if _, err := st.CreateGrant(ctx, storeHostGrant(c.ID, z.ID, "x.dev.webapp.example.net")); err != nil {
		t.Fatal(err)
	}
	const smaller = `
zones: [example.org]
instances:
  default: { server_addr: other:7000, zones: [example.org] }
clients:
  home-pi: { token_env: FRP_GATE_TOKEN_HOME_PI }
`
	_, err := Apply(ctx, st, resolve(t, smaller, defaultEnv), false)
	if err == nil || !strings.Contains(err.Error(), "zone dev.webapp.example.net left the file, but grants made in the UI still use it") {
		t.Fatalf("want a zone-in-use error, got %v", err)
	}
	// Nothing of the failed apply may remain.
	in, _ := st.InstanceByName(ctx, "default")
	if in.ServerAddr != "gate.example.org:7000" {
		t.Error("instance was changed by a failed apply")
	}
	if g, err := st.GroupByName(ctx, "webapp"); err != nil || !g.Managed {
		t.Error("group was deleted by a failed apply")
	}
}

func TestApplyDisabledOnlyWhenExplicit(t *testing.T) {
	st, ctx := newStore(t)
	apply(t, st, ctx, homeYAML, false)
	c, _ := st.ClientByName(ctx, "home-pi")
	// Disabled in the UI as an emergency switch...
	if err := st.SetClientDisabled(ctx, c.ID, true); err != nil {
		t.Fatal(err)
	}
	// ...survives an apply of a file that does not mention "disabled".
	if got := apply(t, st, ctx, homeYAML, false); len(got) != 0 {
		t.Errorf("apply changed something: %v", got)
	}
	if c, _ = st.ClientByName(ctx, "home-pi"); !c.Disabled {
		t.Fatal("apply re-enabled a client although the file does not set disabled")
	}
	// "disabled: false" in the file re-enables it.
	explicit := strings.Replace(homeYAML, "    groups: []\n", "    groups: []\n    disabled: false\n", 1)
	mustContain(t, apply(t, st, ctx, explicit, false), "~ client home-pi: disabled true → false")
	if c, _ = st.ClientByName(ctx, "home-pi"); c.Disabled {
		t.Fatal("disabled: false did not re-enable the client")
	}
}

func TestApplyTokenConflict(t *testing.T) {
	st, ctx := newStore(t)
	if _, err := st.CreateClient(ctx, "other", token.Hash(piToken), ""); err != nil {
		t.Fatal(err)
	}
	_, err := Apply(ctx, st, resolve(t, homeYAML, defaultEnv), false)
	if err == nil || !strings.Contains(err.Error(), "client home-pi: its token is already used by another client") {
		t.Fatalf("got %v", err)
	}
}

func TestApplyWritesAudit(t *testing.T) {
	st, ctx := newStore(t)
	apply(t, st, ctx, homeYAML, false)
	es, err := st.ListAudit(ctx, 0, 100)
	if err != nil || len(es) < 8 {
		t.Fatalf("%d entries, %v", len(es), err)
	}
	for _, e := range es {
		if e.Source != "apply" || e.Actor != "test.yaml" {
			t.Errorf("entry without actor: %+v", e)
		}
		if strings.Contains(e.Detail, piToken) || strings.Contains(e.Detail, token.Hash(piToken)) {
			t.Errorf("audit entry holds a secret: %+v", e)
		}
	}
}

// TestApplyAfterDryRunRollsBackTheFirstStep: the FRP_GATE_INSTANCE_KEY step
// runs in the same transaction, so a dry run leaves no trace of it either,
// while apply sees its result (the instance is adopted, not created).
func TestApplyAfterDryRunRollsBackTheFirstStep(t *testing.T) {
	st, ctx := newStore(t)
	before := func(tx *store.Store) error {
		_, err := tx.CreateInstance(ctx, "default", token.Hash(keyValue), "")
		return err
	}
	res, err := ApplyAfter(ctx, st, resolve(t, homeYAML, defaultEnv), true, before)
	if err != nil {
		t.Fatal(err)
	}
	mustContain(t, lines(res), "= instance default")
	if _, err := st.InstanceByName(ctx, "default"); err == nil {
		t.Error("dry run kept the instance made by the first step")
	}
}
