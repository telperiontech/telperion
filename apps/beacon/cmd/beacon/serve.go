package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/api"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/declare"
	"github.com/telperiontech/telperion/apps/beacon/internal/metrics"
	"github.com/telperiontech/telperion/apps/beacon/internal/observe"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
	"github.com/telperiontech/telperion/apps/beacon/internal/store"
	"github.com/telperiontech/telperion/apps/beacon/internal/web"
	"github.com/telperiontech/telperion/libs/go-kit/audit"
	"github.com/telperiontech/telperion/libs/go-kit/health"
	"github.com/telperiontech/telperion/libs/go-kit/httpserver"
	"github.com/telperiontech/telperion/libs/go-kit/session"
)

// serve runs Beacon until SIGINT/SIGTERM or until a listener fails.
func serve() error {
	cfg, err := readSettings(os.Getenv, true)
	if err != nil {
		return err
	}
	log := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: cfg.LogLevel}))
	slog.SetDefault(log)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	st, err := store.Open(ctx, cfg.DBPath)
	if err != nil {
		return fmt.Errorf("open database %s: %w", cfg.DBPath, err)
	}
	defer st.Close()
	if err := applyAtStart(ctx, st, cfg.ConfigFile, log); err != nil {
		return err
	}

	met := metrics.New(version)
	broker := &observe.Broker{}
	client := platform.New("beacon/"+version, 30*time.Second)
	sched := &observe.Scheduler{
		Store: st, Client: client, Log: log, Opt: cfg.Poll, OnPoll: met.Poll, Publish: broker.Publish,
		Build: func(c catalog.Catalog) ([]observe.Job, error) { return observe.Build(c, client) },
	}
	key, err := st.Secret(ctx, "admin_session_key", 32)
	if err != nil {
		return err
	}
	views := api.Views{Store: st, Now: time.Now}

	ingest := http.NewServeMux()
	ingest.Handle("GET /healthz", health.Handler(st.Ping))
	ingest.Handle("GET /metrics", met.Handler(views.Gauges))
	admin := api.New(api.Options{
		Views: views, Store: st, Broker: broker, Status: sched.Status, UI: web.Handler(), Log: log,
		Auth: &session.Auth{Password: cfg.AdminPassword, Key: key, Cookie: "beacon_session", AllowBasic: true},
	})

	go func() {
		if err := sched.Run(ctx); err != nil {
			log.Error("observation loop stopped", "err", err)
			stop()
		}
	}()
	go pruneLoop(ctx, st, log)
	log.Info("beacon started", "version", version, "ingest", cfg.IngestAddr, "admin", cfg.AdminAddr,
		"db", cfg.DBPath, "config", cfg.ConfigFile)
	return httpserver.Run(ctx, 10*time.Second,
		httpserver.New(cfg.IngestAddr, ingest), httpserver.New(cfg.AdminAddr, admin))
}

// applyAtStart applies BEACON_CONFIG; an invalid file stops the start, so a
// broken config never runs half-applied.
func applyAtStart(ctx context.Context, st *store.Store, file string, log *slog.Logger) error {
	if file == "" {
		log.Warn("BEACON_CONFIG is not set; using the stored config (apply one with `beacon apply -f FILE`)")
		return nil
	}
	f, err := declare.ParseFile(file)
	if err != nil {
		return fmt.Errorf("BEACON_CONFIG: %w", err)
	}
	c, err := f.Resolve(declare.OSEnv())
	if err != nil {
		return fmt.Errorf("BEACON_CONFIG %s is invalid, nothing was changed:\n%s", file, indent(err.Error()))
	}
	actx := audit.WithActor(ctx, audit.Actor{Source: "start", Who: file})
	res, err := declare.Apply(actx, st, c, false)
	if err != nil {
		return fmt.Errorf("BEACON_CONFIG %s could not be applied, nothing was changed: %w", file, err)
	}
	for _, ch := range res.Changes {
		log.Info("config applied", "change", ch.String())
	}
	log.Info("config file applied", "file", file, "changes", len(res.Changes), "packages", len(c.Packages))
	return nil
}

// Retention of the logs.
const (
	eventsKeep = 50_000
	eventsAge  = 90 * 24 * time.Hour
	auditKeep  = 10_000
)

func pruneLoop(ctx context.Context, st *store.Store, log *slog.Logger) {
	t := time.NewTicker(time.Hour)
	defer t.Stop()
	for {
		if _, err := st.PruneEvents(ctx, eventsKeep, eventsAge); err != nil {
			log.Warn("prune events failed", "err", err)
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
