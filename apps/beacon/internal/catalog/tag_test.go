package catalog

import "testing"

func TestTagMatcher(t *testing.T) {
	ng, err := NewTagMatcher(DefaultTag, "ng")
	if err != nil {
		t.Fatal(err)
	}
	if v, ok := ng.Version("ng-v1.2.3"); !ok || v != "1.2.3" {
		t.Errorf("ng-v1.2.3 = %q %v", v, ok)
	}
	for _, tag := range []string{"ng-pack-v1.2.3", "ng-v1.2", "xng-v1.2.3", "ng-v1.2.3x"} {
		if _, ok := ng.Version(tag); ok {
			t.Errorf("%s matched package ng", tag)
		}
	}
	if v, ok := ng.Version("ng-v2.0.0-rc.1"); !ok || v != "2.0.0-rc.1" {
		t.Errorf("prerelease = %q %v", v, ok)
	}
	if got := ng.Tag("1.0.0"); got != "ng-v1.0.0" {
		t.Errorf("Tag = %q", got)
	}

	plain, _ := NewTagMatcher("v{version}", "site")
	if v, ok := plain.Version("v0.9.0"); !ok || v != "0.9.0" {
		t.Errorf("v{version} = %q %v", v, ok)
	}
}
