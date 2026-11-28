package api

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/telperiontech/telperion/libs/go-kit/audit"
)

// session answers whether the request carries a valid session; the UI asks
// it before showing anything but the login page.
func (s server) session(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"authenticated": s.Auth.Valid(r)})
}

// login checks {"password": "..."} and sets the session cookie. A wrong
// password waits a second (go-kit session) and is audited.
func (s server) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "send {\"password\": \"...\"}")
		return
	}
	ctx := audit.WithActor(r.Context(), audit.Actor{Source: "ui", Who: r.RemoteAddr})
	if !s.Auth.Login(w, r, body.Password) {
		s.Log.Warn("admin login failed", "remote", r.RemoteAddr)
		_ = s.Store.Audit(ctx, "session.login_failed", "admin", "")
		writeError(w, http.StatusUnauthorized, "wrong password")
		return
	}
	_ = s.Store.Audit(ctx, "session.login", "admin", "")
	w.WriteHeader(http.StatusNoContent)
}

func (s server) logout(w http.ResponseWriter, r *http.Request) {
	s.Auth.Logout(w, r)
	w.WriteHeader(http.StatusNoContent)
}
