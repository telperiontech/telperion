package envx

import (
	"os"
	"path/filepath"
	"testing"
)

func env(m map[string]string) func(string) string { return func(k string) string { return m[k] } }

func TestOr(t *testing.T) {
	if got := Or(env(nil), "X", "def"); got != "def" {
		t.Errorf("unset = %q", got)
	}
	if got := Or(env(map[string]string{"X": "  v "}), "X", "def"); got != "v" {
		t.Errorf("set = %q", got)
	}
}

func TestSecret(t *testing.T) {
	file := filepath.Join(t.TempDir(), "s")
	if err := os.WriteFile(file, []byte("from-file\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if got, _ := Secret(env(map[string]string{"S": "plain"}), "S"); got != "plain" {
		t.Errorf("plain = %q", got)
	}
	if got, _ := Secret(env(map[string]string{"S": "plain", "S_FILE": file}), "S"); got != "from-file" {
		t.Errorf("file = %q", got)
	}
	if _, err := Secret(env(map[string]string{"S_FILE": file + ".missing"}), "S"); err == nil {
		t.Error("a missing file was accepted")
	}
}
