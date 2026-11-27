package main

import (
	"fmt"
	"log/slog"
	"strings"
)

// listenEnv holds the environment variables Phase 0 reads: where the two
// listeners bind and how much to log. The YAML config comes in Phase 1.
type listenEnv struct {
	IngestAddr string // webhooks, CDEvents, /healthz, /metrics; may face the internet
	AdminAddr  string // UI and JSON API; keep behind a reverse proxy
	LogLevel   slog.Level
}

// readListenEnv reads the settings. getenv is os.Getenv outside tests.
func readListenEnv(getenv func(string) string) (listenEnv, error) {
	e := listenEnv{
		IngestAddr: envOr(getenv, "BEACON_INGEST_ADDR", ":7700"),
		AdminAddr:  envOr(getenv, "BEACON_ADMIN_ADDR", ":7701"),
	}
	if err := e.LogLevel.UnmarshalText([]byte(envOr(getenv, "BEACON_LOG_LEVEL", "info"))); err != nil {
		return e, fmt.Errorf("BEACON_LOG_LEVEL: %w", err)
	}
	return e, nil
}

// envOr returns the trimmed value of key, or def when it is empty.
func envOr(getenv func(string) string, key, def string) string {
	if v := strings.TrimSpace(getenv(key)); v != "" {
		return v
	}
	return def
}
