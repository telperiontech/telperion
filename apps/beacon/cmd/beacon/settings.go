package main

import (
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/observe"
	"github.com/telperiontech/telperion/libs/go-kit/envx"
)

// settings are Beacon's environment variables (BEACON_*). Everything about
// packages and platforms is in the YAML config file instead.
type settings struct {
	IngestAddr    string // webhooks (later), /healthz, /metrics; may face the internet
	AdminAddr     string // UI, JSON API, SSE; keep behind a reverse proxy
	LogLevel      slog.Level
	DBPath        string
	ConfigFile    string // applied at every start when set
	AdminPassword string
	Poll          observe.Options
}

// minPasswordLen is the shortest accepted admin password.
const minPasswordLen = 12

// readSettings reads the environment. getenv is os.Getenv outside tests. The
// admin password is required only to serve.
func readSettings(getenv func(string) string, serving bool) (settings, error) {
	s := settings{
		IngestAddr: envx.Or(getenv, "BEACON_INGEST_ADDR", ":7700"),
		AdminAddr:  envx.Or(getenv, "BEACON_ADMIN_ADDR", ":7701"),
		DBPath:     envx.Or(getenv, "BEACON_DB", "/data/beacon.db"),
		ConfigFile: envx.Or(getenv, "BEACON_CONFIG", ""),
		Poll:       observe.DefaultOptions(),
	}
	var errs []error
	if err := s.LogLevel.UnmarshalText([]byte(envx.Or(getenv, "BEACON_LOG_LEVEL", "info"))); err != nil {
		errs = append(errs, fmt.Errorf("BEACON_LOG_LEVEL: %w", err))
	}
	for _, d := range []struct {
		name string
		into *time.Duration
	}{{"BEACON_POLL_HOT", &s.Poll.Hot}, {"BEACON_POLL_WARM", &s.Poll.Warm}, {"BEACON_POLL_COLD", &s.Poll.Cold}} {
		if v := envx.Or(getenv, d.name, ""); v != "" {
			p, err := time.ParseDuration(v)
			if err != nil || p < time.Second {
				errs = append(errs, fmt.Errorf("%s: a duration of at least 1s, e.g. 2m", d.name))
				continue
			}
			*d.into = p
		}
	}
	if v := envx.Or(getenv, "BEACON_POLL_WORKERS", ""); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 32 {
			errs = append(errs, errors.New("BEACON_POLL_WORKERS: 1 to 32"))
		} else {
			s.Poll.Workers = n
		}
	}
	if serving {
		pw, err := envx.Secret(getenv, "BEACON_ADMIN_PASSWORD")
		switch {
		case err != nil:
			errs = append(errs, err)
		case len(pw) < minPasswordLen:
			errs = append(errs, fmt.Errorf("BEACON_ADMIN_PASSWORD (or _FILE) must be set, at least %d characters", minPasswordLen))
		}
		s.AdminPassword = pw
	}
	return s, errors.Join(errs...)
}
