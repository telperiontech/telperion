// Package session is single-password admin authentication: a constant-time
// password check, HMAC-signed expiring session cookies (HttpOnly,
// SameSite=Strict, Secure behind HTTPS) and a fixed delay after a failed login.
// Pair it with http.CrossOriginProtection for CSRF.
package session

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// Auth checks the admin password and issues and validates session cookies.
// Password, Key and Cookie are required; the rest have defaults.
type Auth struct {
	Password string // the admin password
	Key      []byte // HMAC key for cookies; keep it stable to survive restarts
	Cookie   string // cookie name, e.g. "beacon_session"

	TTL        time.Duration       // session lifetime (default 12h)
	FailDelay  time.Duration       // wait after a wrong password (default 1s)
	AllowBasic bool                // Require also accepts HTTP Basic auth with the password
	Now        func() time.Time    // default time.Now
	Sleep      func(time.Duration) // default time.Sleep
}

// CheckPassword compares p with the password in constant time.
func (a *Auth) CheckPassword(p string) bool {
	x, y := sha256.Sum256([]byte(p)), sha256.Sum256([]byte(a.Password))
	return subtle.ConstantTimeCompare(x[:], y[:]) == 1
}

// Login sets a session cookie when password is right. When it is wrong it
// waits FailDelay (slowing guessing) and returns false.
func (a *Auth) Login(w http.ResponseWriter, r *http.Request, password string) bool {
	if !a.CheckPassword(password) {
		a.sleep(a.failDelay())
		return false
	}
	exp := a.now().Add(a.ttl())
	v := strconv.FormatInt(exp.Unix(), 10)
	http.SetCookie(w, a.cookie(r, v+"."+a.sign(v), exp, 0))
	return true
}

// Logout clears the session cookie.
func (a *Auth) Logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, a.cookie(r, "", time.Time{}, -1))
}

// Valid reports whether r carries an unexpired, correctly signed session.
func (a *Auth) Valid(r *http.Request) bool {
	c, err := r.Cookie(a.Cookie)
	if err != nil {
		return false
	}
	v, sig, ok := strings.Cut(c.Value, ".")
	if !ok || !hmac.Equal([]byte(sig), []byte(a.sign(v))) {
		return false
	}
	exp, err := strconv.ParseInt(v, 10, 64)
	return err == nil && a.now().Unix() < exp
}

// Require passes authenticated requests to next and the rest to deny.
func (a *Auth) Require(next, deny http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if a.Valid(r) {
			next.ServeHTTP(w, r)
			return
		}
		if _, p, ok := r.BasicAuth(); ok && a.AllowBasic && a.CheckPassword(p) {
			next.ServeHTTP(w, r)
			return
		}
		deny.ServeHTTP(w, r)
	})
}

// IsHTTPS reports whether the client used HTTPS, directly or through a proxy
// that sets X-Forwarded-Proto.
func IsHTTPS(r *http.Request) bool {
	return r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}

func (a *Auth) cookie(r *http.Request, value string, exp time.Time, maxAge int) *http.Cookie {
	return &http.Cookie{
		Name: a.Cookie, Value: value, Path: "/", Expires: exp, MaxAge: maxAge,
		HttpOnly: true, Secure: IsHTTPS(r), SameSite: http.SameSiteStrictMode,
	}
}

func (a *Auth) sign(v string) string {
	m := hmac.New(sha256.New, a.Key)
	m.Write([]byte(v))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

func (a *Auth) now() time.Time {
	if a.Now != nil {
		return a.Now()
	}
	return time.Now()
}

func (a *Auth) sleep(d time.Duration) {
	if a.Sleep != nil {
		a.Sleep(d)
		return
	}
	time.Sleep(d)
}

func (a *Auth) ttl() time.Duration {
	if a.TTL > 0 {
		return a.TTL
	}
	return 12 * time.Hour
}

func (a *Auth) failDelay() time.Duration {
	if a.FailDelay > 0 {
		return a.FailDelay
	}
	return time.Second
}
