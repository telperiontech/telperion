package portrange

import "testing"

func TestParse(t *testing.T) {
	if a, b, err := Parse("25565"); err != nil || a != 25565 || b != 25565 {
		t.Errorf("single: %d %d %v", a, b, err)
	}
	if a, b, err := Parse(" 6000 - 6010 "); err != nil || a != 6000 || b != 6010 {
		t.Errorf("range: %d %d %v", a, b, err)
	}
	for _, in := range []string{"", "0", "70000", "10-5", "a", "1-"} {
		if _, _, err := Parse(in); err == nil {
			t.Errorf("Parse(%q) accepted", in)
		}
	}
}

func TestFormatRoundTrip(t *testing.T) {
	for _, s := range []string{"25565", "6000-6010"} {
		a, b, err := Parse(s)
		if err != nil || Format(a, b) != s {
			t.Errorf("round trip %q: %q %v", s, Format(a, b), err)
		}
	}
}
