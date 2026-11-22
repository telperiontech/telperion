package declare

import (
	"strings"
	"testing"
)

func TestParseStrict(t *testing.T) {
	cases := map[string]string{
		"unknown key":    "zones: [a.example]\nzone: [b.example]\n",
		"unknown nested": "clients:\n  x: { token: abc }\n",
		"empty":          "",
		"only comments":  "# nothing\n",
		"declares none":  "zones: []\n",
		"two documents":  "zones: [a.example]\n---\nzones: [b.example]\n",
		"ports as list":  "grants:\n  - { client: x, kind: port, ports: [1, 2] }\n",
	}
	for name, in := range cases {
		if _, err := Parse(strings.NewReader(in)); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
}

func TestParsePortsScalar(t *testing.T) {
	f, err := Parse(strings.NewReader("grants:\n  - { client: x, kind: port, ports: 25565 }\n  - { client: x, kind: port, ports: 6000-6010 }\n"))
	if err != nil {
		t.Fatal(err)
	}
	if f.Grants[0].Ports != "25565" || f.Grants[1].Ports != "6000-6010" {
		t.Errorf("ports: %q %q", f.Grants[0].Ports, f.Grants[1].Ports)
	}
}

func TestEncodeRoundTrip(t *testing.T) {
	f, err := Parse(strings.NewReader(homeYAML))
	if err != nil {
		t.Fatal(err)
	}
	var b strings.Builder
	if err := f.Encode(&b); err != nil {
		t.Fatal(err)
	}
	g, err := Parse(strings.NewReader(b.String()))
	if err != nil {
		t.Fatalf("re-parse: %v\n%s", err, b.String())
	}
	if len(g.Grants) != 3 || g.Clients["home-pi"].TokenEnv != "FRP_GATE_TOKEN_HOME_PI" || g.Grants[1].Ports != "25565" {
		t.Errorf("round trip lost data:\n%s", b.String())
	}
}
