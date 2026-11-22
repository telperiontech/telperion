package names

import (
	"reflect"
	"testing"
)

func TestLabel(t *testing.T) {
	for in, want := range map[string]string{"Alice": "alice", " home-pi ": "home-pi", "a1": "a1"} {
		got, err := Label("client", in)
		if err != nil || got != want {
			t.Errorf("Label(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, in := range []string{"", "-a", "a-", "a.b", "a_b", "ç", "{client}"} {
		if _, err := Label("client", in); err == nil {
			t.Errorf("Label(%q) accepted", in)
		}
	}
}

func TestDomain(t *testing.T) {
	got, err := Domain("App.Example.COM.", false)
	if err != nil || got != "app.example.com" {
		t.Fatalf("got %q, %v", got, err)
	}
	if _, err := Domain("*.example.com", false); err == nil {
		t.Error("wildcard accepted without allowWildcard")
	}
	if got, err := Domain("*.example.com", true); err != nil || got != "*.example.com" {
		t.Errorf("wildcard rejected: %v", err)
	}
	for _, in := range []string{"", "com", "a.*.com", "a..com", "a b.com"} {
		if _, err := Domain(in, true); err == nil {
			t.Errorf("Domain(%q) accepted", in)
		}
	}
}

func TestWildcardParents(t *testing.T) {
	got := WildcardParents("a.b.c.d")
	want := []string{"*.b.c.d", "*.c.d"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	if len(WildcardParents("c.d")) != 0 {
		t.Fatal("two-label name has no wildcard parents")
	}
}
