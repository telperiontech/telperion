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
