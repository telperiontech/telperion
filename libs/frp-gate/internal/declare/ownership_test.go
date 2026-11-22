package declare

import (
	"errors"
	"testing"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/admin"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/token"
)

func storeHostGrant(clientID, zoneID int64, pattern string) store.Grant {
	return store.Grant{ClientID: clientID, Kind: store.KindHost, ZoneID: zoneID, Pattern: pattern}
}

// TestUIObjectsAreLeftAlone: objects made in the UI survive every apply,
// including one that removes everything managed.
func TestUIObjectsAreLeftAlone(t *testing.T) {
	st, ctx := newStore(t)
	svc := &admin.Service{Store: st}
	if _, err := svc.CreateZone(ctx, "ui.example"); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.CreateGroup(ctx, "uigroup"); err != nil {
		t.Fatal(err)
	}
	if _, _, err := svc.CreateClient(ctx, "alice", "", []string{"uigroup"}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.CreateGrant(ctx, admin.GrantInput{Group: "uigroup", Kind: "host", Zone: "ui.example", Pattern: "*.{client}"}); err != nil {
		t.Fatal(err)
	}
	apply(t, st, ctx, homeYAML, false)
	// A UI grant on a managed client is the UI's, too.
	if _, err := svc.CreateGrant(ctx, admin.GrantInput{Client: "home-pi", Kind: "host", Zone: "ui.example", Pattern: "pi"}); err != nil {
		t.Fatal(err)
	}
	apply(t, st, ctx, "zones: [other.example]\n", false)

	if _, err := st.ZoneByDomain(ctx, "ui.example"); err != nil {
		t.Error("UI zone deleted")
	}
	if _, err := st.GroupByName(ctx, "uigroup"); err != nil {
		t.Error("UI group deleted")
	}
	if c, err := st.ClientByName(ctx, "alice"); err != nil || c.Managed {
		t.Error("UI client deleted or adopted")
	}
	if _, err := st.ClientByName(ctx, "home-pi"); err == nil {
		t.Error("managed client not deleted after it left the file")
	}
	gs, _ := st.ListGrants(ctx)
	if len(gs) != 1 || gs[0].Managed {
		t.Errorf("want only the UI group grant left, got %+v", gs)
	}
}

// TestAdoptExisting: an object made in the UI with the same name as one in
// the file becomes managed, keeping its id and, if it matches, its token.
func TestAdoptExisting(t *testing.T) {
	st, ctx := newStore(t)
	svc := &admin.Service{Store: st}
	if _, err := svc.CreateZone(ctx, "example.org"); err != nil {
		t.Fatal(err)
	}
	c, err := st.CreateClient(ctx, "home-pi", token.Hash(piToken), "Pi frpc")
	if err != nil {
		t.Fatal(err)
	}
	got := apply(t, st, ctx, homeYAML, true)
	mustContain(t, got, "= zone example.org", "= client home-pi")
	for _, l := range got {
		if l == "~ client home-pi: token changed" {
			t.Error("same token reported as changed")
		}
	}
	apply(t, st, ctx, homeYAML, false)
	after, _ := st.ClientByName(ctx, "home-pi")
	if after.ID != c.ID || !after.Managed || !token.Equal(piToken, after.TokenHash) {
		t.Errorf("adoption changed the client: %+v", after)
	}
}

// TestServiceRefusesManaged: the UI and API (one Service) refuse to edit or
// delete managed objects, but disabling a managed client works.
func TestServiceRefusesManaged(t *testing.T) {
	st, ctx := newStore(t)
	apply(t, st, ctx, homeYAML, false)
	svc := &admin.Service{Store: st}
	gs, _ := st.ListGrants(ctx)

	refused := map[string]error{
		"delete client":   svc.DeleteClient(ctx, "home-pi"),
		"delete zone":     svc.DeleteZone(ctx, "example.org"),
		"delete group":    svc.DeleteGroup(ctx, "webapp"),
		"add member":      svc.SetMember(ctx, "webapp", "home-pi", true),
		"instance zones":  svc.SetInstanceZones(ctx, "default", nil),
		"delete instance": svc.DeleteInstance(ctx, "default"),
		"delete grant":    svc.DeleteGrant(ctx, gs[0].ID),
	}
	_, _, refused["rotate token"] = svc.RotateClientToken(ctx, "home-pi")
	_, _, refused["new client in managed group"] = svc.CreateClient(ctx, "bob", "", []string{"webapp"})
	for what, err := range refused {
		if !errors.As(err, new(admin.ManagedError)) {
			t.Errorf("%s: want ManagedError, got %v", what, err)
		}
	}
	// The instance key is not declared in homeYAML, so it may be rotated.
	if _, _, err := svc.RotateInstanceKey(ctx, "default"); err != nil {
		t.Errorf("rotate undeclared instance key: %v", err)
	}
	if err := svc.SetClientDisabled(ctx, "home-pi", true); err != nil {
		t.Errorf("disable managed client: %v", err)
	}
}
