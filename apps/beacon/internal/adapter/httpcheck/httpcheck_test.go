package httpcheck

import (
	"net/http"
	"strings"
	"testing"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
)

func TestExtract(t *testing.T) {
	h := http.Header{}
	h.Set("X-Version", "v1.2.3")
	cases := []struct {
		src  catalog.VersionSource
		body string
		want string
	}{
		{catalog.VersionSource{Header: "X-Version"}, "", "1.2.3"},
		{catalog.VersionSource{JSON: "/build/version"}, `{"build": {"version": "2.0.0"}}`, "2.0.0"},
		{catalog.VersionSource{JSON: "/list/1"}, `{"list": ["a", "3.1.0"]}`, "3.1.0"},
		{catalog.VersionSource{Regex: `version: (\S+)`}, "app\nversion: 4.0.0-rc.1\n", "4.0.0-rc.1"},
	}
	for _, c := range cases {
		got, err := Extract(c.src, h, strings.NewReader(c.body))
		if err != nil || got != c.want {
			t.Errorf("%+v = %q %v, want %q", c.src, got, err, c.want)
		}
	}
	if _, err := Extract(catalog.VersionSource{JSON: "/missing"}, h, strings.NewReader(`{}`)); err == nil {
		t.Error("a missing key gave a version")
	}
}
