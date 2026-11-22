package admin

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/token"
)

func newService(t *testing.T) (*Service, context.Context) {
	t.Helper()
	st, err := store.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	return &Service{Store: st}, context.Background()
}

func TestFullPattern(t *testing.T) {
	cases := map[string]string{
		"*.{client}":                  "*.{client}.dev.example.com",
		"*.{client}.dev.example.com":  "*.{client}.dev.example.com",
		"@":                           "dev.example.com",
		"":                            "dev.example.com",
		"Status":                      "status.dev.example.com",
		"*.{client}.dev.example.com.": "*.{client}.dev.example.com",
	}
	for in, want := range cases {
		got, err := fullPattern(in, "dev.example.com")
		if err != nil || got != want {
			t.Errorf("fullPattern(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, in := range []string{"a.*", "{user}", "a b"} {
		if _, err := fullPattern(in, "dev.example.com"); err == nil {
			t.Errorf("fullPattern(%q) accepted", in)
		}
	}
}

func TestParsePorts(t *testing.T) {
	if a, b, err := parsePorts("25565"); err != nil || a != 25565 || b != 25565 {
		t.Errorf("single: %d %d %v", a, b, err)
	}
	if a, b, err := parsePorts(" 6000 - 6010 "); err != nil || a != 6000 || b != 6010 {
		t.Errorf("range: %d %d %v", a, b, err)
	}
	for _, in := range []string{"", "0", "70000", "10-5", "a", "1-"} {
		if _, _, err := parsePorts(in); err == nil {
			t.Errorf("parsePorts(%q) accepted", in)
		}
	}
}

func TestCreateGrantValidation(t *testing.T) {
	svc, ctx := newService(t)
	if _, _, err := svc.CreateClient(ctx, "alice", "", nil); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.CreateZone(ctx, "dev.example.com"); err != nil {
		t.Fatal(err)
	}
	g, err := svc.CreateGrant(ctx, GrantInput{Client: "alice", Kind: "host", Zone: "dev.example.com", Pattern: "*.{client}"})
	if err != nil || g.Pattern != "*.{client}.dev.example.com" {
		t.Fatalf("got %+v, %v", g, err)
	}
	bad := []GrantInput{
		{Kind: "host", Zone: "dev.example.com", Pattern: "x"},                       // no subject
		{Client: "alice", Group: "g", Kind: "host"},                                 // both
		{Client: "nobody", Kind: "host", Zone: "dev.example.com", Pattern: "x"},     // unknown client
		{Client: "alice", Kind: "host", Zone: "other.example.com", Pattern: "x"},    // unknown zone
		{Client: "alice", Kind: "host", Zone: "dev.example.com", Pattern: "a.*.b"},  // "*" not leftmost
		{Client: "alice", Kind: "port", Instance: "main", Proto: "tcp", Ports: "1"}, // unknown instance
		{Client: "alice", Kind: "magic"},
	}
	for _, in := range bad {
		if _, err := svc.CreateGrant(ctx, in); err == nil {
			t.Errorf("accepted %+v", in)
		} else if in := (inputError{}); !errors.As(err, &in) {
			t.Errorf("%+v: %v is not an input error", in, err)
		}
	}
}

func TestCreateClientWithGroups(t *testing.T) {
	svc, ctx := newService(t)
	if _, err := svc.CreateGroup(ctx, "webapp"); err != nil {
		t.Fatal(err)
	}
	c, tok, err := svc.CreateClient(ctx, "Bob", "laptop", []string{"webapp"})
	if err != nil || c.Name != "bob" || !strings.HasPrefix(tok, token.ClientPrefix) || !token.Equal(tok, c.TokenHash) {
		t.Fatalf("got %+v %q %v", c, tok, err)
	}
	ids, _ := svc.Store.GroupIDsOfClient(ctx, c.ID)
	if len(ids) != 1 {
		t.Fatalf("not a member: %v", ids)
	}
	if _, _, err := svc.CreateClient(ctx, "x", "", []string{"nope"}); err == nil {
		t.Fatal("unknown group accepted")
	}
	if _, err := svc.Client(ctx, "x"); !errors.Is(err, store.ErrNotFound) {
		t.Fatal("client created despite unknown group")
	}
}

func TestEnsureInstance(t *testing.T) {
	svc, ctx := newService(t)
	key1, key2 := strings.Repeat("a", 32), strings.Repeat("b", 32)
	if err := svc.EnsureInstance(ctx, "default", key1, ""); err != nil {
		t.Fatal(err)
	}
	if err := svc.EnsureInstance(ctx, "default", key1, ""); err != nil {
		t.Fatal(err)
	}
	if err := svc.EnsureInstance(ctx, "default", key2, ""); err != nil {
		t.Fatal(err)
	}
	in, err := svc.Store.InstanceByKeyHash(ctx, token.Hash(key2))
	if err != nil || in.Name != "default" {
		t.Fatalf("key not updated: %+v %v", in, err)
	}
	if list, _ := svc.Store.ListInstances(ctx); len(list) != 1 {
		t.Fatalf("instances: %+v", list)
	}
}

func TestDeleteZoneInUse(t *testing.T) {
	svc, ctx := newService(t)
	svc.CreateClient(ctx, "a", "", nil)
	svc.CreateZone(ctx, "dev.example.com")
	if _, err := svc.CreateGrant(ctx, GrantInput{Client: "a", Kind: "host", Zone: "dev.example.com", Pattern: "@"}); err != nil {
		t.Fatal(err)
	}
	var in inputError
	if err := svc.DeleteZone(ctx, "dev.example.com"); !errors.As(err, &in) {
		t.Fatalf("got %v", err)
	}
}
