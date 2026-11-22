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

	// Optional: a declarative config file applied at every start.
	ConfigFile string
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
		DBPath:             DBPath(getenv),
		InternalAddr:       env("FRP_GATE_INTERNAL_ADDR", ":7600"),
		AdminAddr:          env("FRP_GATE_ADMIN_ADDR", ":7601"),
		AskMode:            env("FRP_GATE_ASK_MODE", "claimed"),
		PluginAddr:         env("FRP_GATE_PLUGIN_ADDR", "frp-gate:7600"),
		InstanceName:       InstanceName(getenv),
		InstanceServerAddr: env("FRP_GATE_INSTANCE_SERVER_ADDR", ""),
		ConfigFile:         env("FRP_GATE_CONFIG", ""),
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
	if c.InstanceKey, err = InstanceKey(getenv); err != nil {
		errs = append(errs, err)
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

// DBPath is FRP_GATE_DB or its default. The CLI commands (apply, export,
// backup) need only this, not the admin password.
func DBPath(getenv func(string) string) string {
	if v := strings.TrimSpace(getenv("FRP_GATE_DB")); v != "" {
		return v
	}
	return "/data/frp-gate.db"
}

// InstanceKey reads FRP_GATE_INSTANCE_KEY (or _FILE); "" when unset.
func InstanceKey(getenv func(string) string) (string, error) {
	k, err := secret(getenv, "FRP_GATE_INSTANCE_KEY")
	if err != nil {
		return "", err
	}
	if k != "" && len(k) < 32 {
		return "", errors.New("FRP_GATE_INSTANCE_KEY must be at least 32 characters (e.g. openssl rand -hex 32)")
	}
	return k, nil
}

// InstanceName is FRP_GATE_INSTANCE_NAME or "default".
func InstanceName(getenv func(string) string) string {
	if v := strings.TrimSpace(getenv("FRP_GATE_INSTANCE_NAME")); v != "" {
		return v
	}
	return "default"
}
