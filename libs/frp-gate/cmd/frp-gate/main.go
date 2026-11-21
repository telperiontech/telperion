// Command frp-gate is a multi-tenant gateway for frp: an frps server plugin,
// a Caddy on-demand TLS "ask" endpoint and a small admin UI.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/admin"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/ask"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/config"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/frpplugin"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/policy"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// version is set at build time with -ldflags "-X main.version=...".
var version = "dev"

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "version", "--version":
			fmt.Println(version)
			return
		case "healthcheck":
			os.Exit(healthcheck())
		default:
			fmt.Fprintf(os.Stderr, "usage: frp-gate [version|healthcheck]\nConfiguration is read from FRP_GATE_* environment variables; see the README.\n")
			os.Exit(2)
		}
	}
	if err := run(); err != nil {
		slog.Error("frp-gate stopped", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return err
	}
	log := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: cfg.LogLevel}))
	slog.SetDefault(log)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	st, err := store.Open(cfg.DBPath)
	if err != nil {
		return fmt.Errorf("open database %s: %w", cfg.DBPath, err)
	}
	defer st.Close()

	if cfg.InstanceKey != "" {
		svc := &admin.Service{Store: st}
		if err := svc.EnsureInstance(ctx, cfg.InstanceName, cfg.InstanceKey, cfg.InstanceServerAddr); err != nil {
			return fmt.Errorf("FRP_GATE_INSTANCE_*: %w", err)
		}
	}

	pol := policy.New(st, cfg.AskMode, cfg.ClaimRetention, log)

	internal := http.NewServeMux()
	internal.Handle("POST /frps/{key}", &frpplugin.Handler{Store: st, Policy: pol, Log: log})
	internal.Handle("GET /tls/ask", &ask.Handler{Decider: pol, Log: log})
	internal.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		if err := st.Ping(r.Context()); err != nil {
			http.Error(w, "database unavailable", http.StatusServiceUnavailable)
			return
		}
		_, _ = w.Write([]byte("ok\n"))
	})

	adm, err := admin.New(ctx, admin.Options{
		Store: st, Password: cfg.AdminPassword, PluginAddr: cfg.PluginAddr,
		SessionTimeout: cfg.SessionTimeout, Log: log,
	})
	if err != nil {
		return err
	}

	servers := []*http.Server{newServer(cfg.InternalAddr, internal), newServer(cfg.AdminAddr, adm)}
	errc := make(chan error, len(servers))
	for _, s := range servers {
		go func() {
			if err := s.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				errc <- fmt.Errorf("listen %s: %w", s.Addr, err)
			}
		}()
	}
	log.Info("frp-gate started", "version", version, "internal", cfg.InternalAddr, "admin", cfg.AdminAddr,
		"db", cfg.DBPath, "ask_mode", cfg.AskMode)

	go pruneLoop(ctx, st, cfg, log)

	select {
	case <-ctx.Done():
	case err = <-errc:
	}
	shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	for _, s := range servers {
		_ = s.Shutdown(shutdown)
	}
	log.Info("frp-gate stopped")
	return err
}

func newServer(addr string, h http.Handler) *http.Server {
	return &http.Server{
		Addr: addr, Handler: h,
		ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 30 * time.Second,
		WriteTimeout: 30 * time.Second, IdleTimeout: 2 * time.Minute,
	}
}

// pruneLoop forgets sessions frps never closed (e.g. frps restarted) and
// claims older than the retention window.
func pruneLoop(ctx context.Context, st *store.Store, cfg config.Config, log *slog.Logger) {
	t := time.NewTicker(10 * time.Minute)
	defer t.Stop()
	for {
		now := time.Now()
		if n, err := st.PruneSessions(ctx, now.Add(-24*time.Hour)); err != nil {
			log.Warn("prune sessions failed", "err", err)
		} else if n > 0 {
			log.Debug("pruned stale sessions", "count", n)
		}
		if err := st.PruneClaims(ctx, now.Add(-cfg.ClaimRetention)); err != nil {
			log.Warn("prune claims failed", "err", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

// healthcheck is used by the image's HEALTHCHECK (no curl in distroless).
func healthcheck() int {
	addr := os.Getenv("FRP_GATE_INTERNAL_ADDR")
	if addr == "" {
		addr = ":7600"
	}
	_, port, err := net.SplitHostPort(addr)
	if err != nil {
		return 1
	}
	c := http.Client{Timeout: 3 * time.Second}
	resp, err := c.Get("http://127.0.0.1:" + port + "/healthz")
	if err != nil {
		return 1
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}
