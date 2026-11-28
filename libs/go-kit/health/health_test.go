package health

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandler(t *testing.T) {
	for _, c := range []struct {
		ping func(context.Context) error
		want int
	}{
		{nil, http.StatusOK},
		{func(context.Context) error { return nil }, http.StatusOK},
		{func(context.Context) error { return errors.New("db down") }, http.StatusServiceUnavailable},
	} {
		rec := httptest.NewRecorder()
		Handler(c.ping).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))
		if rec.Code != c.want {
			t.Errorf("status = %d, want %d", rec.Code, c.want)
		}
	}
}

func TestCheck(t *testing.T) {
	srv := httptest.NewServer(Handler(nil))
	defer srv.Close()
	if code := Check(srv.Listener.Addr().String()); code != 0 {
		t.Errorf("healthy = %d", code)
	}
	if code := Check("no-port"); code != 1 {
		t.Errorf("invalid address = %d", code)
	}
}
