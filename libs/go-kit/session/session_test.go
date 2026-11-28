package session

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func newAuth(now *time.Time) (*Auth, *time.Duration) {
	slept := new(time.Duration)
	return &Auth{
		Password: "correct horse", Key: []byte("k"), Cookie: "s",
		Now: func() time.Time { return *now }, Sleep: func(d time.Duration) { *slept += d },
	}, slept
}

func login(a *Auth, password string) (*http.Cookie, bool) {
	rec := httptest.NewRecorder()
	ok := a.Login(rec, httptest.NewRequest(http.MethodPost, "/", nil), password)
	cs := rec.Result().Cookies()
	if len(cs) == 0 {
		return nil, ok
	}
	return cs[0], ok
}

func withCookie(c *http.Cookie) *http.Request {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.AddCookie(c)
	return r
}

func TestLogin(t *testing.T) {
	now := time.Unix(1_000_000, 0)
	a, slept := newAuth(&now)

	if _, ok := login(a, "wrong"); ok || *slept != time.Second {
		t.Fatalf("wrong password: ok=%v slept=%v", ok, *slept)
	}
	c, ok := login(a, "correct horse")
	if !ok || c == nil || !c.HttpOnly || c.SameSite != http.SameSiteStrictMode {
		t.Fatalf("login cookie = %+v ok=%v", c, ok)
	}
	if !a.Valid(withCookie(c)) {
		t.Error("fresh session is invalid")
	}

	_, sig, _ := strings.Cut(c.Value, ".")
	forged := *c
	forged.Value = "9999999999." + sig
	if a.Valid(withCookie(&forged)) {
		t.Error("a cookie with a changed expiry was accepted")
	}

	now = now.Add(13 * time.Hour)
	if a.Valid(withCookie(c)) {
		t.Error("an expired session was accepted")
	}
}

func TestRequire(t *testing.T) {
	now := time.Now()
	a, _ := newAuth(&now)
	ok := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(200) })
	deny := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(401) })
	h := a.Require(ok, deny)

	serve := func(r *http.Request) int {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, r)
		return rec.Code
	}
	if code := serve(httptest.NewRequest(http.MethodGet, "/", nil)); code != 401 {
		t.Errorf("anonymous = %d", code)
	}
	basic := httptest.NewRequest(http.MethodGet, "/", nil)
	basic.SetBasicAuth("x", "correct horse")
	if code := serve(basic); code != 401 {
		t.Errorf("basic auth without AllowBasic = %d", code)
	}
	a.AllowBasic = true
	if code := serve(basic); code != 200 {
		t.Errorf("basic auth with AllowBasic = %d", code)
	}
}
