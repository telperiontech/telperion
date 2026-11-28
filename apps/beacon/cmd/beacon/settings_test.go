package main

import (
	"log/slog"
	"testing"
	"time"
)

func env(m map[string]string) func(string) string { return func(k string) string { return m[k] } }

func TestReadSettings(t *testing.T) {
	s, err := readSettings(env(nil), false)
	if err != nil {
		t.Fatal(err)
	}
	if s.IngestAddr != ":7700" || s.AdminAddr != ":7701" || s.DBPath != "/data/beacon.db" ||
		s.LogLevel != slog.LevelInfo || s.Poll.Cold != 15*time.Minute {
		t.Errorf("defaults = %+v", s)
	}

	if _, err := readSettings(env(nil), true); err == nil {
		t.Error("serving without an admin password was accepted")
	}
	if _, err := readSettings(env(map[string]string{"BEACON_ADMIN_PASSWORD": "short"}), true); err == nil {
		t.Error("a short admin password was accepted")
	}

	s, err = readSettings(env(map[string]string{
		"BEACON_ADMIN_PASSWORD": "a long admin password", "BEACON_POLL_COLD": "30s", "BEACON_POLL_WORKERS": "2",
		"BEACON_LOG_LEVEL": "debug",
	}), true)
	if err != nil || s.Poll.Cold != 30*time.Second || s.Poll.Workers != 2 || s.LogLevel != slog.LevelDebug {
		t.Errorf("overrides = %+v %v", s, err)
	}
	if _, err := readSettings(env(map[string]string{"BEACON_POLL_HOT": "10ms"}), false); err == nil {
		t.Error("a sub-second poll interval was accepted")
	}
}
