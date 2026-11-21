// Package config reads frp-gate's settings from environment variables.
package config

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"
)

// Config is the runtime configuration.
type Config struct {
	DBPath         string
	InternalAddr   string // frps plugin + Caddy ask + health; keep private
	AdminAddr      string // web UI + JSON API; put behind HTTPS
	AdminPassword  string
	AskMode        string
	ClaimRetention time.Duration
	SessionTimeout time.Duration // a session counts as connected if seen this recently
	PluginAddr     string        // how frps reaches InternalAddr (shown in frps.toml snippets)
	LogLevel       slog.Level

	// Optional: create/keep an frps instance whose plugin key comes from the
	// environment, so frps.toml can be written before frp-gate first runs.
	InstanceName       string
	InstanceKey        string
	InstanceServerAddr string
}

// Load reads the configuration. getenv is os.Getenv outside tests.
func Load(getenv func(string) string) (Config, error) {
	env := func(k, def string) string {
		if v := strings.TrimSpace(getenv(k)); v != "" {
			return v
		}
		return def
	}
	c := Config{
		DBPath:             env("FRP_GATE_DB", "/data/frp-gate.db"),
		InternalAddr:       env("FRP_GATE_INTERNAL_ADDR", ":7600"),
		AdminAddr:          env("FRP_GATE_ADMIN_ADDR", ":7601"),
		AskMode:            env("FRP_GATE_ASK_MODE", "claimed"),
		PluginAddr:         env("FRP_GATE_PLUGIN_ADDR", "frp-gate:7600"),
		InstanceName:       env("FRP_GATE_INSTANCE_NAME", "default"),
		InstanceServerAddr: env("FRP_GATE_INSTANCE_SERVER_ADDR", ""),
	}
	var errs []error
	var err error
	if c.AdminPassword, err = secret(getenv, "FRP_GATE_ADMIN_PASSWORD"); err != nil {
		errs = append(errs, err)
	} else if len(c.AdminPassword) < 12 {
		errs = append(errs, errors.New("FRP_GATE_ADMIN_PASSWORD (or _FILE) must be set, at least 12 characters"))
	}
	if c.AskMode != "claimed" && c.AskMode != "granted" {
		errs = append(errs, fmt.Errorf("FRP_GATE_ASK_MODE must be claimed or granted, got %q", c.AskMode))
	}
	if c.ClaimRetention, err = time.ParseDuration(env("FRP_GATE_CLAIM_RETENTION", "720h")); err != nil {
		errs = append(errs, fmt.Errorf("FRP_GATE_CLAIM_RETENTION: %w", err))
	}
	if c.SessionTimeout, err = time.ParseDuration(env("FRP_GATE_SESSION_TIMEOUT", "90s")); err != nil {
		errs = append(errs, fmt.Errorf("FRP_GATE_SESSION_TIMEOUT: %w", err))
	}
	if err := c.LogLevel.UnmarshalText([]byte(env("FRP_GATE_LOG_LEVEL", "info"))); err != nil {
		errs = append(errs, fmt.Errorf("FRP_GATE_LOG_LEVEL: %w", err))
	}
	if k, err := secret(getenv, "FRP_GATE_INSTANCE_KEY"); err != nil {
		errs = append(errs, err)
	} else {
		c.InstanceKey = k
	}
	if c.InstanceKey != "" && len(c.InstanceKey) < 32 {
		errs = append(errs, errors.New("FRP_GATE_INSTANCE_KEY must be at least 32 characters (e.g. openssl rand -hex 32)"))
	}
	return c, errors.Join(errs...)
}

// secret reads NAME or the file named by NAME_FILE (Docker secrets).
func secret(getenv func(string) string, name string) (string, error) {
	if path := strings.TrimSpace(getenv(name + "_FILE")); path != "" {
		b, err := os.ReadFile(path)
		if err != nil {
			return "", fmt.Errorf("%s_FILE: %w", name, err)
		}
		return strings.TrimSpace(string(b)), nil
	}
	return strings.TrimSpace(getenv(name)), nil
}
