package declare

import (
	"testing"

	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

// TestExampleConfig keeps examples/beacon.yaml valid.
func TestExampleConfig(t *testing.T) {
	f, err := ParseFile("../../examples/beacon.yaml")
	if err != nil {
		t.Fatal(err)
	}
	c, err := f.Resolve(Env{
		Getenv:   func(string) string { return "" },
		ReadFile: func(string) ([]byte, error) { return []byte("key"), nil },
	})
	if err != nil {
		t.Fatal(err)
	}
	gate, ok := c.Package("frp-gate")
	if !ok || len(c.Packages) != 18 || gate.Chain()[len(gate.Chain())-1] != model.Published {
		t.Errorf("packages = %d, frp-gate chain = %v", len(c.Packages), gate.Chain())
	}
}

// TestExampleReleases: every package of the example releases through GitHub
// and has a path for its unreleased changes.
func TestExampleReleases(t *testing.T) {
	f, _ := ParseFile("../../examples/beacon.yaml")
	c, err := f.Resolve(Env{Getenv: func(string) string { return "" }, ReadFile: func(string) ([]byte, error) { return []byte("key"), nil }})
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range c.Packages {
		if p.Release == nil || p.Release.Kind() != "github-release" || p.Path == "" {
			t.Errorf("%s: release %+v, path %q", p.Name, p.Release, p.Path)
		}
	}
}
