package semver

import "testing"

func TestNext(t *testing.T) {
	cases := []struct {
		latest string
		bump   Bump
		want   string
	}{
		{"4.1.0", Patch, "4.1.1"},
		{"4.1.3", Minor, "4.2.0"},
		{"4.1.3", Major, "5.0.0"},
		{"", Patch, "0.0.1"},
		{"", Minor, "0.1.0"},
		{"", Major, "1.0.0"},
		{"1.2.0-rc.1", Minor, "1.2.0"},
		{"1.2.0-rc.1", Patch, "1.2.0"},
		{"2.0.0-rc.1", Major, "2.0.0"},
		{"1.2.3-rc.1", Minor, "1.3.0"},
	}
	for _, c := range cases {
		got, err := Next(c.latest, c.bump)
		if err != nil || got != c.want {
			t.Errorf("Next(%q, %s) = %q, %v; want %q", c.latest, c.bump, got, err, c.want)
		}
	}
	if _, err := Next("1.0.0", "huge"); err == nil {
		t.Error("an unknown bump was accepted")
	}
}

func TestKindAndLatest(t *testing.T) {
	if k := Kind("4.1.0", "5.0.0"); k != Major {
		t.Errorf("Kind = %q", k)
	}
	if k := Kind("4.1.0", "4.1.1"); k != Patch {
		t.Errorf("Kind = %q", k)
	}
	if k := Kind("4.1.0", "4.1.0"); k != "" {
		t.Errorf("Kind of an equal version = %q", k)
	}
	if l := Latest([]string{"1.0.0", "1.10.0", "1.9.0", "2.0.0-rc.1", "x"}); l != "1.10.0" {
		t.Errorf("Latest = %q", l)
	}
}
