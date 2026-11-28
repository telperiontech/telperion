package web

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestEmbeddedUI fails the image build when the UI stage produced no app.
func TestEmbeddedUI(t *testing.T) {
	rec := httptest.NewRecorder()
	Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "<bcn-root") {
		t.Fatalf("GET / = %d %q, want the beacon-ui index.html", rec.Code, rec.Body.String())
	}
}
