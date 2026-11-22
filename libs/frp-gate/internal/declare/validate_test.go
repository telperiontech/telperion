package declare

import (
	"strings"
	"testing"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/token"
)

func TestResolveHomeExample(t *testing.T) {
	d := resolve(t, homeYAML, defaultEnv)
	if len(d.Zones) != 2 || len(d.Instances) != 1 || len(d.Clients) != 1 || len(d.Grants) != 3 {
		t.Fatalf("unexpected: %+v", d)
	}
	if d.Clients[0].TokenHash != token.Hash(piToken) {
		t.Error("token_env was not resolved to the token's hash")
	}
	if d.Instances[0].KeyHash != "" {
		t.Error("instance without a key source must keep its key")
	}
	if g := d.Grants[0]; g.Pattern != "*.alisah.in" || g.String() != "client home-pi: host *.alisah.in" {
		t.Errorf("grant 0: %+v %s", g, g)
	}
	if g := d.Grants[1]; g.PortFrom != 25565 || g.String() != "client home-pi: tcp 25565 on default" {
		t.Errorf("grant 1: %s", g)
	}
	if g := d.Grants[2]; g.Pattern != "*.{client}.dev.videochat.telperion.tr" {
		t.Errorf("grant 2: %s", g)
	}
}

// TestResolveReportsEveryError checks that all problems are reported at
// once and that a secret never appears in an error.
func TestResolveReportsEveryError(t *testing.T) {
	const yaml = `
zones: [a.example, a.example, "bad zone"]
instances:
  main: { zones: [b.example], key_env: SHORT }
  Bad_Name: {}
groups: [g1]
clients:
  one: { token_env: MISSING }
  two: { token_env: SHORT }
  three: { token_env: SAME, token_file: /x }
  four: { token_sha256: nothex }
  five: { token_file: /missing }
  six: { groups: [nope] }
  seven: { token_env: DUP }
  eight: { token_env: DUP }
grants:
  - { client: nobody, kind: host, zone: a.example, pattern: "*" }
  - { group: g1, client: one, kind: host, zone: a.example, pattern: "*" }
  - { group: g1, kind: host, zone: c.example, pattern: "*" }
  - { group: g1, kind: host, zone: a.example, pattern: "a.*" }
  - { group: g1, kind: port, instance: main, proto: sctp, ports: "0" }
  - { group: g1, kind: host, zone: a.example, pattern: x, proto: tcp }
  - { group: g1, kind: other }
  - { group: g1, kind: host, zone: a.example, pattern: "*" }
  - { group: g1, kind: host, zone: a.example, pattern: "*" }
`
	f, err := Parse(strings.NewReader(yaml))
	if err != nil {
		t.Fatal(err)
	}
	dup := "fg_duplicateduplicateduplicateduplicatedup"
	_, err = f.Resolve(testEnv(map[string]string{"SHORT": "tiny-secret-value", "DUP": dup}, nil))
	got := errText(err)
	for _, want := range []string{
		"zones: a.example is listed twice",
		`zones: host name "bad zone"`,
		`instance main: zone "b.example" is not declared`,
		"instance main key: the secret must be at least 32 characters",
		`instance name "bad_name"`,
		"client one token: environment variable MISSING is not set",
		"client two token: the secret must be at least 32 characters",
		"client three token: set only one of",
		"client four token: sha256 must be 64 hex characters",
		"client five token: cannot read /missing",
		`client six: group "nope" is not declared`,
		"eight and seven use the same token",
		`grants[0]: client "nobody" is not declared`,
		"grants[1]: set client or group, not both",
		`grants[2]: zone "c.example" is not declared`,
		"grants[3]: ",
		"grants[4]: proto must be tcp or udp",
		"grants[4]: ports must be",
		"grants[5]: instance, proto and ports are only for port grants",
		"grants[6]: kind must be host or port",
		"grants[8]: duplicate of an earlier grant",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("missing error %q", want)
		}
	}
	for _, secret := range []string{"tiny-secret-value", dup} {
		if strings.Contains(got, secret) {
			t.Errorf("an error message contains a secret: %q", secret)
		}
	}
	if t.Failed() {
		t.Log(got)
	}
}

func TestResolveSecretSources(t *testing.T) {
	sha := token.Hash(piToken)
	env := testEnv(map[string]string{"T": piToken}, map[string]string{"/run/secrets/t": piToken + "\n"})
	for _, src := range []string{"token_env: T", "token_file: /run/secrets/t", "token_sha256: " + strings.ToUpper(sha)} {
		d := resolve(t, "clients:\n  c: { "+src+" }\n", env)
		if d.Clients[0].TokenHash != sha {
			t.Errorf("%s: hash %q", src, d.Clients[0].TokenHash)
		}
	}
}
