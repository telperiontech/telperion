package semver

import (
	"slices"
	"testing"
)

func TestParse(t *testing.T) {
	for _, s := range []string{"0.0.0", "1.2.3", "10.20.30", "1.0.0-rc.1", "1.0.0-alpha+001", "1.0.0+build.5"} {
		if _, ok := Parse(s); !ok {
			t.Errorf("Parse(%q) failed", s)
		}
	}
	for _, s := range []string{"", "1", "1.2", "v1.2.3", "01.2.3", "1.2.3-01", "1.2.3-", "1.2.3.4"} {
		if _, ok := Parse(s); ok {
			t.Errorf("Parse(%q) accepted", s)
		}
	}
	v, _ := Parse("4.10.2-beta.3+sha.1")
	if v.Major != 4 || v.Minor != 10 || v.Patch != 2 || !slices.Equal(v.Pre, []string{"beta", "3"}) {
		t.Errorf("parsed %+v", v)
	}
}

func TestOrder(t *testing.T) {
	// The precedence example of semver.org, then plain releases.
	sorted := []string{
		"1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-alpha.beta", "1.0.0-beta", "1.0.0-beta.2",
		"1.0.0-beta.11", "1.0.0-rc.1", "1.0.0", "1.0.1", "1.2.0", "1.10.0", "2.0.0",
	}
	shuffled := slices.Clone(sorted)
	slices.Reverse(shuffled)
	slices.SortFunc(shuffled, CompareStrings)
	if !slices.Equal(shuffled, sorted) {
		t.Errorf("sorted = %v", shuffled)
	}
	if CompareStrings("1.0.0+a", "1.0.0+b") != 0 {
		t.Error("build metadata changed the order")
	}
	if CompareStrings("junk", "0.0.1") != -1 {
		t.Error("an unparsable version did not sort first")
	}
}
