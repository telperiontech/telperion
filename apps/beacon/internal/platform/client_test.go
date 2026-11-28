package platform

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestConditionalAndBudget(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.Header().Set("X-RateLimit-Limit", "100")
		w.Header().Set("X-RateLimit-Remaining", "3")
		w.Header().Set("X-RateLimit-Reset", "9999999999")
		if r.Header.Get("If-None-Match") == `"v1"` {
			w.WriteHeader(http.StatusNotModified)
			return
		}
		w.Header().Set("ETag", `"v1"`)
		_, _ = w.Write([]byte(`{"n": 1}`))
	}))
	defer srv.Close()
	c := New("test", 5*time.Second)
	ctx := context.Background()

	var out struct{ N int }
	if err := c.JSON(ctx, Request{URL: srv.URL + "/x?token=secret", Conditional: true}, &out); err != nil || out.N != 1 {
		t.Fatalf("first = %+v %v", out, err)
	}
	if err := c.JSON(ctx, Request{URL: srv.URL + "/x?token=secret", Conditional: true}, &out); !errors.Is(err, ErrNotModified) {
		t.Fatalf("second = %v, want ErrNotModified", err)
	}
	host := strings.TrimPrefix(srv.URL, "http://")
	if f, _ := c.Budget(host).Stretch(time.Now()); f != 8 {
		t.Errorf("stretch with 3%% left = %v", f)
	}
}

func TestErrorsHideQuery(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "nope", http.StatusNotFound)
	}))
	defer srv.Close()
	err := New("test", time.Second).JSON(context.Background(), Request{URL: srv.URL + "/p?access_token=s3cret"}, &struct{}{})
	if !IsStatus(err, 404) || strings.Contains(err.Error(), "s3cret") {
		t.Errorf("err = %v", err)
	}
}
