package ask

import (
	"context"
	"io"
	"log/slog"
	"net/http/httptest"
	"testing"
)

type fake map[string]bool

func (f fake) Ask(_ context.Context, host string) (bool, string) { return f[host], "no" }

func TestHandler(t *testing.T) {
	h := &Handler{Decider: fake{"ok.example.com": true}, Log: slog.New(slog.NewTextHandler(io.Discard, nil))}
	for host, want := range map[string]int{"ok.example.com": 200, "other.example.com": 403, "": 403} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", "/tls/ask?domain="+host, nil))
		if rec.Code != want {
			t.Errorf("%q: %d, want %d", host, rec.Code, want)
		}
	}
}
