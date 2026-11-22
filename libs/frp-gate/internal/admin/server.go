// Package admin serves the web UI and the JSON API for managing clients,
// zones, groups, grants and frps instances.
package admin

import (
	"context"
	"io/fs"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/audit"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// Options configure the admin server.
type Options struct {
	Store          *store.Store
	Password       string
	PluginAddr     string        // shown in frps.toml snippets
	SessionTimeout time.Duration // "connected" means seen this recently
	Log            *slog.Logger
}

// Server is the admin HTTP handler.
type Server struct {
	svc            *Service
	auth           *auth
	pages          pages
	log            *slog.Logger
	pluginAddr     string
	sessionTimeout time.Duration
	handler        http.Handler
}

// New builds the admin handler.
func New(ctx context.Context, o Options) (*Server, error) {
	secret, err := o.Store.Secret(ctx, "admin_session_key", 32)
	if err != nil {
		return nil, err
	}
	pg, err := loadPages()
	if err != nil {
		return nil, err
	}
	s := &Server{
		svc:            &Service{Store: o.Store, Log: o.Log},
		auth:           &auth{password: o.Password, secret: secret, now: time.Now},
		pages:          pg,
		log:            o.Log,
		pluginAddr:     o.PluginAddr,
		sessionTimeout: o.SessionTimeout,
	}
	s.handler = s.routes()
	return s, nil
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) { s.handler.ServeHTTP(w, r) }

func (s *Server) routes() http.Handler {
	ui := http.NewServeMux()
	ui.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/status", http.StatusSeeOther)
	})
	ui.HandleFunc("GET /status", s.statusPage)
	ui.HandleFunc("GET /clients", s.clientsPage)
	ui.HandleFunc("POST /clients", s.clientCreate)
	ui.HandleFunc("GET /clients/{name}", s.clientPage)
	ui.HandleFunc("POST /clients/{name}/{action}", s.clientAction)
	ui.HandleFunc("GET /zones", s.zonesPage)
	ui.HandleFunc("POST /zones", s.zoneCreate)
	ui.HandleFunc("POST /zones/{domain}/delete", s.zoneDelete)
	ui.HandleFunc("GET /groups", s.groupsPage)
	ui.HandleFunc("POST /groups", s.groupCreate)
	ui.HandleFunc("POST /groups/{name}/delete", s.groupDelete)
	ui.HandleFunc("POST /groups/{name}/members", s.memberAdd)
	ui.HandleFunc("POST /groups/{name}/members/{client}/delete", s.memberRemove)
	ui.HandleFunc("GET /grants", s.grantsPage)
	ui.HandleFunc("POST /grants", s.grantCreate)
	ui.HandleFunc("POST /grants/{id}/delete", s.grantDelete)
	ui.HandleFunc("GET /instances", s.instancesPage)
	ui.HandleFunc("GET /audit", s.auditPage)
	ui.HandleFunc("POST /instances", s.instanceCreate)
	ui.HandleFunc("POST /instances/{name}/{action}", s.instanceAction)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /login", s.loginPage)
	mux.HandleFunc("POST /login", s.login)
	mux.HandleFunc("POST /logout", s.logout)
	static, _ := fs.Sub(assets, "static")
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServerFS(static)))
	mux.Handle("/api/", s.auth.requireAPI(withActor(audit.SourceAPI, s.apiRoutes())))
	mux.Handle("/", s.auth.requireUI(withActor(audit.SourceUI, ui)))

	// Rejects cross-site form posts (CSRF) using Sec-Fetch-Site / Origin.
	return securityHeaders(http.NewCrossOriginProtection().Handler(mux))
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Frame-Options", "DENY")
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "same-origin")
		h.Set("Content-Security-Policy", "default-src 'self'; script-src 'unsafe-inline'; style-src 'self'; frame-ancestors 'none'")
		h.Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

func (s *Server) loginPage(w http.ResponseWriter, r *http.Request) {
	s.render(w, r, "login", pageData{Title: "Log in"})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	if !s.auth.checkPassword(r.PostFormValue("password")) {
		s.log.Warn("admin login failed", "remote", r.RemoteAddr)
		time.Sleep(time.Second) // slows down guessing
		s.render(w, r, "login", pageData{Title: "Log in", Err: "Wrong password.", Status: http.StatusUnauthorized})
		return
	}
	s.auth.issue(w, r)
	s.svc.record(audit.WithActor(r.Context(), actorOf(audit.SourceUI, r)), "admin.login", "", "")
	http.Redirect(w, r, "/status", http.StatusSeeOther)
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	s.auth.clear(w, r)
	http.Redirect(w, r, "/login", http.StatusSeeOther)
}

// withActor tags each request's context with who acts, for the audit log.
func withActor(source string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r.WithContext(audit.WithActor(r.Context(), actorOf(source, r))))
	})
}

// actorOf describes the client of a request: its address, and the address
// Caddy reports in X-Forwarded-For (informational; it can be forged by
// whoever reaches the admin listener directly).
func actorOf(source string, r *http.Request) audit.Actor {
	who := r.RemoteAddr
	if xff := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-For"), ",")[0]); xff != "" {
		who = xff + " via " + r.RemoteAddr
	}
	return audit.Actor{Source: source, Who: who}
}
