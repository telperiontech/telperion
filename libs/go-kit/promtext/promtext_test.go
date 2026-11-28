package promtext

import (
	"strings"
	"testing"
)

func TestWrite(t *testing.T) {
	var b strings.Builder
	Header(&b, "x_total", "counter", "Things.")
	Sample(&b, "x_total", 3, "kind", `a"b`)
	Sample(&b, "x_ratio", 0.5)
	want := "# HELP x_total Things.\n# TYPE x_total counter\n" +
		`x_total{kind="a\"b"} 3` + "\nx_ratio 0.5\n"
	if b.String() != want {
		t.Errorf("got\n%s\nwant\n%s", b.String(), want)
	}
}
