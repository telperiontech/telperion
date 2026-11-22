package pattern

import "testing"

func TestParse(t *testing.T) {
	for _, s := range []string{"*.{client}.dev.example.com", "{client}.example.com", "a.example.com", "*.example.com", "A.Example.com."} {
		if _, err := Parse(s); err != nil {
			t.Errorf("Parse(%q): %v", s, err)
		}
	}
	for _, s := range []string{"", "com", "a.*.example.com", "*.*.example.com", "{user}.example.com", "x{client}.example.com", "a..com", "a_b.com"} {
		if _, err := Parse(s); err == nil {
			t.Errorf("Parse(%q) accepted", s)
		}
	}
	if got := MustParse("A.Example.com.").String(); got != "a.example.com" {
		t.Errorf("not normalised: %q", got)
	}
}

func TestCapture(t *testing.T) {
	p := MustParse("*.{client}.dev.example.com")
	cases := []struct {
		host, client string
		ok           bool
	}{
		{"app.alice.dev.example.com", "alice", true},
		{"api.laptop.bob.dev.example.com", "bob", true},
		{"a.b.c.alice.dev.example.com", "alice", true},
		{"alice.dev.example.com", "", false}, // "*" needs at least one label
		{"dev.example.com", "", false},
		{"app.alice.dev.example.org", "", false},
		{"app.alice.prod.example.com", "", false},
		{"*.alice.dev.example.com", "alice", true},    // all of *.alice... is granted
		{"*.pc.alice.dev.example.com", "alice", true}, // deeper wildcard too
		{"*.dev.example.com", "", false},              // would cover other clients
		{"*.example.com", "", false},
	}
	for _, c := range cases {
		client, ok := p.Capture(c.host)
		if ok != c.ok || client != c.client {
			t.Errorf("Capture(%q) = %q, %v; want %q, %v", c.host, client, ok, c.client, c.ok)
		}
	}
}

func TestCaptureExactAndPlaceholderOnly(t *testing.T) {
	exact := MustParse("status.example.com")
	if _, ok := exact.Capture("status.example.com"); !ok {
		t.Error("exact name not matched")
	}
	for _, h := range []string{"x.status.example.com", "*.status.example.com", "example.com"} {
		if _, ok := exact.Capture(h); ok {
			t.Errorf("exact pattern matched %q", h)
		}
	}
	single := MustParse("{client}.example.com")
	if c, ok := single.Capture("alice.example.com"); !ok || c != "alice" {
		t.Errorf("got %q %v", c, ok)
	}
	if _, ok := single.Capture("a.alice.example.com"); ok {
		t.Error("placeholder matched two labels")
	}
	if _, ok := single.Capture("*.example.com"); ok {
		t.Error("non-wildcard pattern covered a wildcard request")
	}
}

func TestCaptureRepeatedPlaceholder(t *testing.T) {
	p := MustParse("{client}.{client}.example.com")
	if _, ok := p.Capture("a.a.example.com"); !ok {
		t.Error("equal labels not matched")
	}
	if _, ok := p.Capture("a.b.example.com"); ok {
		t.Error("different labels matched one placeholder")
	}
}

func TestCovers(t *testing.T) {
	p := MustParse("*.{client}.dev.example.com")
	if !p.Covers("app.alice.dev.example.com", "alice") {
		t.Error("own name not covered")
	}
	if p.Covers("app.bob.dev.example.com", "alice") {
		t.Error("foreign name covered")
	}
	shared := MustParse("*.shared.example.com")
	if !shared.Covers("x.shared.example.com", "anyone") {
		t.Error("pattern without placeholder must cover any client")
	}
}

func TestWithin(t *testing.T) {
	p := MustParse("*.{client}.dev.example.com")
	if !p.Within("dev.example.com") || !p.Within("example.com") {
		t.Error("pattern not within its zone")
	}
	if p.Within("other.example.com") || p.Within("x.dev.example.com") {
		t.Error("pattern within a foreign zone")
	}
	if MustParse("{client}.example.com").Within("alice.example.com") {
		t.Error("placeholder label counted as literal zone label")
	}
}

func TestExpand(t *testing.T) {
	if got := MustParse("*.{client}.dev.example.com").Expand("alice"); got != "*.alice.dev.example.com" {
		t.Errorf("got %q", got)
	}
}
