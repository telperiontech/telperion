package spa

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func testFS() fstest.MapFS {
	return fstest.MapFS{
		"index.html":           {Data: []byte("<app-root></app-root>")},
		"main-ABCD1234.js":     {Data: []byte("console.log(1)")},
		"favicon.svg":          {Data: []byte("<svg/>")},
		"media/logo-0000.woff": {Data: []byte("font")},
	}
}

func get(t *testing.T, h http.Handler, target string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, target, nil))
	return rec
}

func TestHandler(t *testing.T) {
	h := Handler(testFS())
	cases := []struct {
		target      string
		status      int
		body, cache string
	}{
		{"/", 200, "<app-root>", "no-cache"},
		{"/packages/js-utils", 200, "<app-root>", "no-cache"},
		{"/media", 200, "<app-root>", "no-cache"},
		{"/main-ABCD1234.js", 200, "console.log", "public, max-age=31536000, immutable"},
		{"/favicon.svg", 200, "<svg/>", "no-cache"},
		{"/missing-ABCD1234.js", 404, "", ""},
	}
	for _, c := range cases {
		t.Run(c.target, func(t *testing.T) {
			rec := get(t, h, c.target)
			if rec.Code != c.status {
				t.Fatalf("status = %d, want %d", rec.Code, c.status)
			}
			if !strings.Contains(rec.Body.String(), c.body) {
				t.Errorf("body = %q, want it to contain %q", rec.Body.String(), c.body)
			}
			if got := rec.Header().Get("Cache-Control"); got != c.cache {
				t.Errorf("Cache-Control = %q, want %q", got, c.cache)
			}
		})
	}
}
