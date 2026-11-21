package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func envOf(m map[string]string) func(string) string { return func(k string) string { return m[k] } }

func TestDefaults(t *testing.T) {
	c, err := Load(envOf(map[string]string{"FRP_GATE_ADMIN_PASSWORD": "a-long-password"}))
	if err != nil {
		t.Fatal(err)
	}
	if c.InternalAddr != ":7600" || c.AdminAddr != ":7601" || c.AskMode != "claimed" ||
		c.ClaimRetention != 720*time.Hour || c.SessionTimeout != 90*time.Second || c.InstanceName != "default" {
		t.Fatalf("unexpected defaults: %+v", c)
	}
}

func TestErrors(t *testing.T) {
	_, err := Load(envOf(map[string]string{
		"FRP_GATE_ASK_MODE":     "maybe",
		"FRP_GATE_INSTANCE_KEY": "short",
	}))
	if err == nil {
		t.Fatal("no error")
	}
	for _, want := range []string{"ADMIN_PASSWORD", "ASK_MODE", "INSTANCE_KEY"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error %q does not mention %s", err, want)
		}
	}
}

func TestSecretFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "pw")
	if err := os.WriteFile(path, []byte("from-a-file-123\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	c, err := Load(envOf(map[string]string{"FRP_GATE_ADMIN_PASSWORD_FILE": path}))
	if err != nil || c.AdminPassword != "from-a-file-123" {
		t.Fatalf("got %q, %v", c.AdminPassword, err)
	}
}
