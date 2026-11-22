package declare

import (
	"context"
	"errors"
	"io/fs"
	"strings"
	"testing"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/audit"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

const (
	piToken  = "fg_pitokenpitokenpitokenpitokenpitokenpitoken" // 46 chars
	keyValue = "0123456789abcdef0123456789abcdef0123456789abcdef"
)

// testEnv serves environment variables and files from maps.
func testEnv(vars map[string]string, files map[string]string) Env {
	return Env{
		Getenv: func(k string) string { return vars[k] },
		ReadFile: func(p string) ([]byte, error) {
			if v, ok := files[p]; ok {
				return []byte(v), nil
			}
			return nil, fs.ErrNotExist
		},
	}
}

var defaultEnv = testEnv(map[string]string{"FRP_GATE_TOKEN_HOME_PI": piToken, "KEY": keyValue}, nil)

func newStore(t *testing.T) (*store.Store, context.Context) {
	t.Helper()
	st, err := store.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	return st, audit.WithActor(context.Background(), audit.Actor{Source: audit.SourceApply, Who: "test.yaml"})
}

// resolve parses and validates a YAML string.
func resolve(t *testing.T, yaml string, env Env) *Desired {
	t.Helper()
	f, err := Parse(strings.NewReader(yaml))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	d, err := f.Resolve(env)
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	return d
}

// apply resolves and applies a YAML string and returns the change lines.
func apply(t *testing.T, st *store.Store, ctx context.Context, yaml string, dryRun bool) []string {
	t.Helper()
	res, err := Apply(ctx, st, resolve(t, yaml, defaultEnv), dryRun)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	return lines(res)
}

func lines(res Result) []string {
	out := []string{}
	for _, c := range res.Changes {
		out = append(out, c.String())
	}
	return out
}

func mustContain(t *testing.T, got []string, want ...string) {
	t.Helper()
	all := strings.Join(got, "\n")
	for _, w := range want {
		if !strings.Contains(all, w) {
			t.Errorf("missing %q in:\n%s", w, all)
		}
	}
}

func errText(err error) string {
	if err == nil {
		return ""
	}
	var parts []string
	if j, ok := err.(interface{ Unwrap() []error }); ok {
		for _, e := range j.Unwrap() {
			parts = append(parts, e.Error())
		}
		return strings.Join(parts, "\n")
	}
	return errors.Unwrap(err).Error() + "\n" + err.Error()
}

// homeYAML is the example from the README.
const homeYAML = `
zones: [alisah.in, dev.videochat.telperion.tr]
instances:
  default: { server_addr: gate.alisah.in:7000, zones: [alisah.in, dev.videochat.telperion.tr] }
groups: [videochat]
clients:
  home-pi:
    note: Pi frpc
    token_env: FRP_GATE_TOKEN_HOME_PI
    groups: []
grants:
  - { client: home-pi, kind: host, zone: alisah.in, pattern: "*" }
  - { client: home-pi, kind: port, instance: default, proto: tcp, ports: "25565" }
  - { group: videochat, kind: host, zone: dev.videochat.telperion.tr, pattern: "*.{client}" }
`
