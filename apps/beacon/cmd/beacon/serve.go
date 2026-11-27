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

	"github.com/telperiontech/telperion/apps/beacon/internal/web"
)

// serve runs both listeners until SIGINT/SIGTERM or until one of them fails.
func serve() error {
	env, err := readListenEnv(os.Getenv)
	if err != nil {
		return err
	}
	log := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: env.LogLevel}))
	slog.SetDefault(log)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	servers := []*http.Server{
		newServer(env.IngestAddr, ingestHandler()),
		newServer(env.AdminAddr, adminHandler()),
	}
	errc := make(chan error, len(servers))
	for _, s := range servers {
		go func() {
			if err := s.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				errc <- fmt.Errorf("listen %s: %w", s.Addr, err)
			}
		}()
	}
	log.Info("beacon started", "version", version, "ingest", env.IngestAddr, "admin", env.AdminAddr)

	select {
	case <-ctx.Done():
	case err = <-errc:
	}
	shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	for _, s := range servers {
		_ = s.Shutdown(shutdown)
	}
	return err
}

// ingestHandler serves the listener that may be reachable from the internet.
// Phase 0 has only the health endpoint; webhooks and CDEvents follow.
func ingestHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok\n"))
	})
	return mux
}

// adminHandler serves the UI (and, from Phase 1, the JSON API under /api).
func adminHandler() http.Handler {
	mux := http.NewServeMux()
	mux.Handle("GET /", web.Handler())
	return mux
}

func newServer(addr string, h http.Handler) *http.Server {
	return &http.Server{
		Addr: addr, Handler: h,
		ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 30 * time.Second,
		WriteTimeout: 30 * time.Second, IdleTimeout: 2 * time.Minute,
	}
}
