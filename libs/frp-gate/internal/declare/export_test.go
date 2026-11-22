package declare

import (
	"context"
	"strings"
	"testing"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/admin"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/token"
)

// TestExportRoundTrip: export → apply to an empty database → export gives
// the same file, and every secret survives as a hash.
func TestExportRoundTrip(t *testing.T) {
	st, ctx := newStore(t)
	apply(t, st, ctx, homeYAML, false)
	svc := &admin.Service{Store: st}
	if _, _, err := svc.CreateClient(ctx, "alice", "UI made", nil); err != nil {
		t.Fatal(err)
	}
	if err := svc.SetClientDisabled(ctx, "alice", true); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.CreateGrant(ctx, admin.GrantInput{Client: "alice", Kind: "port", Instance: "default", Proto: "udp", Ports: "6000-6010"}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.CreateGrant(ctx, admin.GrantInput{Client: "alice", Kind: "host", Zone: "alisah.in", Pattern: "@"}); err != nil {
		t.Fatal(err)
	}

	first := exportText(t, st, ctx)
	for _, want := range []string{"token_sha256: " + token.Hash(piToken), "disabled: true", `pattern: '@'`, "ports: 6000-6010", `ports: "25565"`} {
		if !strings.Contains(first, want) {
			t.Errorf("export lacks %q:\n%s", want, first)
		}
	}
	if strings.Contains(first, piToken) {
		t.Fatal("export contains a token")
	}

	st2, ctx2 := newStore(t)
	apply(t, st2, ctx2, first, false)
	if second := exportText(t, st2, ctx2); second != first {
		t.Errorf("round trip differs:\n--- first\n%s\n--- second\n%s", first, second)
	}
	c, _ := st2.ClientByName(ctx2, "home-pi")
	if !token.Equal(piToken, c.TokenHash) {
		t.Error("token lost in the round trip")
	}
}

func exportText(t *testing.T, st *store.Store, ctx context.Context) string {
	t.Helper()
	f, err := Export(ctx, st)
	if err != nil {
		t.Fatal(err)
	}
	var b strings.Builder
	if err := f.Encode(&b); err != nil {
		t.Fatal(err)
	}
	return b.String()
}
