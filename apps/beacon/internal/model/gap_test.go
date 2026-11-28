package model

import (
	"testing"
	"time"
)

var t0 = time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)

func rows(version string, states ...any) []Row {
	var out []Row
	for i := 0; i+1 < len(states); i += 2 {
		out = append(out, Row{Version: version, Stage: states[i].(Stage), State: states[i+1].(State), Since: t0})
	}
	return out
}

func TestGapsSkipSupersededVersions(t *testing.T) {
	chain := []Stage{Tagged, Built, Published}
	versions := map[string]time.Time{"1.0.0": t0, "1.1.0": t0, "1.2.0": t0, "1.3.0": t0}
	var all []Row
	all = append(all, rows("1.0.0", Tagged, OK)...)                           // old, never built: superseded
	all = append(all, rows("1.1.0", Tagged, OK, Built, OK, Published, OK)...) // complete
	all = append(all, rows("1.2.0", Tagged, OK, Built, Failed)...)            // failed build
	all = append(all, rows("1.3.0", Tagged, OK, Built, OK)...)                // waiting for publish
	cells := Cells(chain, nil, versions, all)
	if cells[0].Version != "1.3.0" || cells[3].Version != "1.0.0" {
		t.Fatalf("order = %v, %v", cells[0].Version, cells[3].Version)
	}

	gaps := Gaps(chain, cells, t0.Add(time.Hour))
	if len(gaps) != 2 {
		t.Fatalf("gaps = %+v", gaps)
	}
	if g := gaps[0]; g.Version != "1.3.0" || g.From != Built || g.To != Published || !g.Stuck {
		t.Errorf("1.3.0 gap = %+v (an hour without publishing is stuck)", g)
	}
	if g := gaps[1]; g.Version != "1.2.0" || g.To != Built || g.State != Failed || !g.Stuck {
		t.Errorf("1.2.0 gap = %+v", g)
	}

	fresh := Gaps(chain, cells, t0.Add(5*time.Minute))
	if fresh[0].Stuck {
		t.Error("five minutes without publishing counted as stuck")
	}
}

func TestPendingIsNotAGap(t *testing.T) {
	chain := []Stage{Tagged, Built}
	cells := Cells(chain, nil, map[string]time.Time{"2.0.0": t0}, rows("2.0.0", Tagged, OK, Built, Pending))
	if gaps := Gaps(chain, cells, t0.Add(time.Hour)); len(gaps) != 0 {
		t.Errorf("gaps = %+v", gaps)
	}
}

func TestDeployedNeedsEveryTarget(t *testing.T) {
	chain := []Stage{Tagged, Deployed}
	r := rows("1.0.0", Tagged, OK)
	r = append(r, Row{Version: "1.0.0", Stage: Deployed, Target: "a", State: OK, Since: t0})
	cells := Cells(chain, []string{"a", "b"}, map[string]time.Time{"1.0.0": t0}, r)
	c := cells[0].Cells[Deployed]
	if c.State != Missing || len(c.Targets) != 2 {
		t.Fatalf("deployed = %+v, want missing until b runs it", c)
	}

	r = append(r, Row{Version: "1.0.0", Stage: Deployed, Target: "b", State: OK, Since: t0.Add(time.Minute)})
	c = Cells(chain, []string{"a", "b"}, map[string]time.Time{"1.0.0": t0}, r)[0].Cells[Deployed]
	if c.State != OK || !c.Since.Equal(t0.Add(time.Minute)) {
		t.Errorf("deployed = %+v, want ok since the last target", c)
	}
}
