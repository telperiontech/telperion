package admin

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

const (
	cookieName = "frp_gate_session"
	sessionTTL = 12 * time.Hour
)

// auth checks the single admin password and issues signed session cookies.
type auth struct {
	password string
	secret   []byte
	now      func() time.Time
}

func (a *auth) checkPassword(p string) bool {
	x, y := sha256.Sum256([]byte(p)), sha256.Sum256([]byte(a.password))
	return subtle.ConstantTimeCompare(x[:], y[:]) == 1
}

func (a *auth) sign(exp string) string {
	m := hmac.New(sha256.New, a.secret)
	m.Write([]byte(exp))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

func isHTTPS(r *http.Request) bool {
	return r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}

func (a *auth) issue(w http.ResponseWriter, r *http.Request) {
	exp := a.now().Add(sessionTTL)
	v := strconv.FormatInt(exp.Unix(), 10)
	http.SetCookie(w, &http.Cookie{
		Name: cookieName, Value: v + "." + a.sign(v), Path: "/", Expires: exp,
		HttpOnly: true, Secure: isHTTPS(r), SameSite: http.SameSiteStrictMode,
	})
}

func (a *auth) clear(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{Name: cookieName, Value: "", Path: "/", MaxAge: -1,
		HttpOnly: true, Secure: isHTTPS(r), SameSite: http.SameSiteStrictMode})
}

func (a *auth) validCookie(r *http.Request) bool {
	c, err := r.Cookie(cookieName)
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

// requireUI redirects to the login page without a valid session.
func (a *auth) requireUI(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !a.validCookie(r) {
			http.Redirect(w, r, "/login", http.StatusSeeOther)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// requireAPI accepts HTTP Basic auth (any user name, the admin password) or
// a UI session cookie.
func (a *auth) requireAPI(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, p, ok := r.BasicAuth(); ok && a.checkPassword(p) {
			next.ServeHTTP(w, r)
			return
		}
		if a.validCookie(r) {
			next.ServeHTTP(w, r)
			return
		}
		w.Header().Set("WWW-Authenticate", `Basic realm="frp-gate"`)
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	})
}
