// Package envx reads settings from the environment. Functions take a getenv
// (os.Getenv outside tests) so they stay pure.
package envx

import (
	"fmt"
	"os"
	"strings"
)

// Or returns the trimmed value of key, or def when it is empty.
func Or(getenv func(string) string, key, def string) string {
	if v := strings.TrimSpace(getenv(key)); v != "" {
		return v
	}
	return def
}

// Secret reads NAME, or the file named by NAME_FILE (Docker secrets), which
// wins when both are set. The value is trimmed; "" means unset.
func Secret(getenv func(string) string, name string) (string, error) {
	if path := strings.TrimSpace(getenv(name + "_FILE")); path != "" {
		b, err := os.ReadFile(path)
		if err != nil {
			return "", fmt.Errorf("%s_FILE: %w", name, err)
		}
		return strings.TrimSpace(string(b)), nil
	}
	return strings.TrimSpace(getenv(name)), nil
}
