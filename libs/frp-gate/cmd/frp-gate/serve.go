package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/admin"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/ask"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/audit"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/config"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/declare"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/frpplugin"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/metrics"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/policy"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// auditKeep is how many audit log entries the prune loop keeps.
const auditKeep = 10000

// serve runs the server until SIGINT/SIGTERM.
func serve() error {
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

	if err := startupState(ctx, st, cfg, log); err != nil {
		return err
	}

	pol := policy.New(st, cfg.AskMode, cfg.ClaimRetention, log)
	pol.SessionTimeout = cfg.SessionTimeout
	met := metrics.New(version)

	internal := http.NewServeMux()
	internal.Handle("POST /frps/{key}", &frpplugin.Handler{Store: st, Policy: pol, Log: log, Metrics: met})
	internal.Handle("GET /tls/ask", &ask.Handler{Decider: pol, Log: log, Metrics: met})
	internal.Handle("GET /metrics", met.Handler(sessionCounts(st, cfg.SessionTimeout)))
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
		"db", cfg.DBPath, "ask_mode", cfg.AskMode, "config", cfg.ConfigFile)

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

// startupState applies FRP_GATE_INSTANCE_KEY, then FRP_GATE_CONFIG. An
// invalid config file stops the start: frp-gate never serves a state the
// file does not describe.
func startupState(ctx context.Context, st *store.Store, cfg config.Config, log *slog.Logger) error {
	ensure, err := ensureInstance(ctx, os.Getenv, log)
	if err != nil {
		return err
	}
	if cfg.ConfigFile == "" {
		if ensure == nil {
			return nil
		}
		return st.WithTx(ctx, ensure)
	}
	f, err := declare.ParseFile(cfg.ConfigFile)
	if err != nil {
		return fmt.Errorf("FRP_GATE_CONFIG: %w", err)
	}
	d, err := f.Resolve(declare.OSEnv())
	if err != nil {
		return fmt.Errorf("FRP_GATE_CONFIG %s is invalid, nothing was changed:\n%w", cfg.ConfigFile, err)
	}
	actx := audit.WithActor(ctx, audit.Actor{Source: audit.SourceStart, Who: cfg.ConfigFile})
	res, err := declare.ApplyAfter(actx, st, d, false, ensure)
	if err != nil {
		return fmt.Errorf("FRP_GATE_CONFIG %s could not be applied, nothing was changed: %w", cfg.ConfigFile, err)
	}
	for _, c := range res.Changes {
		log.Info("config applied", "change", c.String())
	}
	log.Info("config file applied", "file", cfg.ConfigFile, "changes", len(res.Changes))
	return nil
}

// sessionCounts reports connected sessions per client for /metrics, with
// every client present.
func sessionCounts(st *store.Store, timeout time.Duration) metrics.SessionCounts {
	return func(ctx context.Context) (map[string]int, error) {
		clients, err := st.ListClients(ctx)
		if err != nil {
			return nil, err
		}
		sessions, err := st.Sessions(ctx, time.Now().Add(-timeout))
		if err != nil {
			return nil, err
		}
		names := map[int64]string{}
		out := map[string]int{}
		for _, c := range clients {
			names[c.ID] = c.Name
			out[c.Name] = 0
		}
		for _, s := range sessions {
			if n, ok := names[s.ClientID]; ok {
				out[n]++
			}
		}
		return out, nil
	}
}

func newServer(addr string, h http.Handler) *http.Server {
	return &http.Server{
		Addr: addr, Handler: h,
		ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 30 * time.Second,
		WriteTimeout: 30 * time.Second, IdleTimeout: 2 * time.Minute,
	}
}

// pruneLoop forgets sessions frps never closed (e.g. frps restarted), claims
// older than the retention window and old audit log entries.
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
		if _, err := st.PruneAudit(ctx, auditKeep); err != nil {
			log.Warn("prune audit log failed", "err", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}
