package manifest

import (
	"reflect"
	"testing"
)

const pkgJSON = `{
  "name": "@acme/ng-pack",
  "version": "0.0.0",
  "peerDependencies": {
    "@acme/js-utils": "^4.0.0",
    "@acme/local": "workspace:*"
  },
  "devDependencies": {
    "@acme/js-utils":"^4.0.0"
  }
}
`

func TestRangesAndSet(t *testing.T) {
	rs, err := Ranges([]byte(pkgJSON), "@acme/js-utils", "@acme/local", "@acme/none")
	if err != nil {
		t.Fatal(err)
	}
	want := []Range{{"@acme/js-utils", "^4.0.0", true}, {"@acme/local", "workspace:*", false}, {"@acme/none", "", false}}
	if !reflect.DeepEqual(rs, want) {
		t.Errorf("ranges = %+v", rs)
	}
	got := string(Set([]byte(pkgJSON), map[string]string{"@acme/js-utils": "^4.2.0", "@acme/local": "^1.0.0"}))
	exp := `{
  "name": "@acme/ng-pack",
  "version": "0.0.0",
  "peerDependencies": {
    "@acme/js-utils": "^4.2.0",
    "@acme/local": "workspace:*"
  },
  "devDependencies": {
    "@acme/js-utils":"^4.2.0"
  }
}
`
	if got != exp {
		t.Errorf("set =\n%s", got)
	}
	if _, err := Ranges([]byte("nope"), "x"); err == nil {
		t.Error("not JSON was read")
	}
}
