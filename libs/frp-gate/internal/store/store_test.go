package store

import (
	"context"
	"errors"
	"testing"
	"time"
)

func openTest(t *testing.T) *Store {
	t.Helper()
	s, err := Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func TestClientsAndConflicts(t *testing.T) {
	ctx := context.Background()
	s := openTest(t)
	c, err := s.CreateClient(ctx, "sahin", "h1", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreateClient(ctx, "sahin", "h2", ""); !errors.Is(err, ErrConflict) {
		t.Fatalf("duplicate name: %v", err)
	}
	if err := s.SetClientDisabled(ctx, c.ID, true); err != nil {
		t.Fatal(err)
	}
	got, err := s.ClientByName(ctx, "sahin")
	if err != nil || !got.Disabled {
		t.Fatalf("got %+v, %v", got, err)
	}
	if _, err := s.ClientByName(ctx, "nobody"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing client: %v", err)
	}
	if err := s.DeleteClient(ctx, 999); !errors.Is(err, ErrNotFound) {
		t.Fatalf("delete missing: %v", err)
	}
}

func TestEffectiveGrantsThroughGroups(t *testing.T) {
	ctx := context.Background()
	s := openTest(t)
	z, _ := s.CreateZone(ctx, "dev.example.com")
	a, _ := s.CreateClient(ctx, "a", "ha", "")
	b, _ := s.CreateClient(ctx, "b", "hb", "")
	g, _ := s.CreateGroup(ctx, "devs")
	if err := s.AddMember(ctx, g.ID, a.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreateGrant(ctx, Grant{GroupID: g.ID, Kind: KindHost, ZoneID: z.ID, Pattern: "*.{client}.dev.example.com"}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreateGrant(ctx, Grant{ClientID: b.ID, Kind: KindHost, ZoneID: z.ID, Pattern: "b.dev.example.com"}); err != nil {
		t.Fatal(err)
	}
	ga, _ := s.EffectiveGrants(ctx, a.ID)
	gb, _ := s.EffectiveGrants(ctx, b.ID)
	if len(ga) != 1 || ga[0].GroupID != g.ID || len(gb) != 1 || gb[0].ClientID != b.ID {
		t.Fatalf("a=%+v b=%+v", ga, gb)
	}
	if err := s.DeleteZone(ctx, z.ID); !errors.Is(err, ErrInUse) {
		t.Fatalf("zone with grants deleted: %v", err)
	}
	if err := s.DeleteGroup(ctx, g.ID); err != nil {
		t.Fatal(err)
	}
	if ga, _ = s.EffectiveGrants(ctx, a.ID); len(ga) != 0 {
		t.Fatalf("group grants survived group deletion: %+v", ga)
	}
}

func TestGrantChecks(t *testing.T) {
	ctx := context.Background()
	s := openTest(t)
	c, _ := s.CreateClient(ctx, "a", "ha", "")
	bad := []Grant{
		{ClientID: c.ID, Kind: KindHost},                                        // no zone/pattern
		{Kind: KindPort, Proto: "tcp", PortFrom: 1, PortTo: 2},                  // no subject
		{ClientID: c.ID, Kind: KindPort, Proto: "sctp", PortFrom: 1, PortTo: 2}, // bad proto, no instance
	}
	for _, g := range bad {
		if _, err := s.CreateGrant(ctx, g); err == nil {
			t.Errorf("accepted %+v", g)
		}
	}
}

func TestSessionsProxiesAndPrune(t *testing.T) {
	ctx := context.Background()
	s := openTest(t)
	now := time.Unix(1_000_000, 0)
	s.SetClock(func() time.Time { return now })
	in, _ := s.CreateInstance(ctx, "main", "kh", "")
	c, _ := s.CreateClient(ctx, "a", "ha", "")
	if err := s.TouchSession(ctx, in.ID, "run1", c.ID); err != nil {
		t.Fatal(err)
	}
	if err := s.AddProxy(ctx, in.ID, "run1", Proxy{Name: "a.web", Type: "http", Domains: []string{"x.example.com", "y.example.com"}}); err != nil {
		t.Fatal(err)
	}
	ss, err := s.Sessions(ctx, time.Time{})
	if err != nil || len(ss) != 1 || len(ss[0].Proxies) != 1 || len(ss[0].Proxies[0].Domains) != 2 {
		t.Fatalf("got %+v, %v", ss, err)
	}
	now = now.Add(time.Hour)
	if n, err := s.PruneSessions(ctx, now.Add(-time.Minute)); err != nil || n != 1 {
		t.Fatalf("prune: %d, %v", n, err)
	}
	if ps, _ := s.SessionProxies(ctx, in.ID, "run1"); len(ps) != 0 {
		t.Fatal("proxies survived their session")
	}
}

func TestClaims(t *testing.T) {
	ctx := context.Background()
	s := openTest(t)
	now := time.Unix(1_000_000, 0)
	s.SetClock(func() time.Time { return now })
	c, _ := s.CreateClient(ctx, "a", "ha", "")
	if err := s.TouchClaims(ctx, c.ID, []string{"x.example.com"}); err != nil {
		t.Fatal(err)
	}
	ids, _ := s.ClaimantsOf(ctx, []string{"x.example.com", "*.example.com"}, now.Add(-time.Hour))
	if len(ids) != 1 || ids[0] != c.ID {
		t.Fatalf("got %v", ids)
	}
	if ids, _ := s.ClaimantsOf(ctx, []string{"x.example.com"}, now.Add(time.Second)); len(ids) != 0 {
		t.Fatalf("old claim returned: %v", ids)
	}
}

func TestSecretIsStable(t *testing.T) {
	ctx := context.Background()
	s := openTest(t)
	a, err := s.Secret(ctx, "k", 32)
	if err != nil || len(a) != 32 {
		t.Fatal(err)
	}
	b, _ := s.Secret(ctx, "k", 32)
	if string(a) != string(b) {
		t.Fatal("secret changed")
	}
}
