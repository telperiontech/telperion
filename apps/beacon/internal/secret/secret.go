// Package secret resolves secret references (*_env, *_file) and mints GitHub
// App installation tokens. Values are read when needed, kept in memory only,
// and never leave this package except to set a request's credentials.
package secret

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
)

// Value reads a referenced secret; "" for an empty reference.
func Value(ref catalog.SecretRef) (string, error) {
	switch {
	case ref.Env != "":
		v := strings.TrimSpace(os.Getenv(ref.Env))
		if v == "" {
			return "", fmt.Errorf("environment variable %s is empty", ref.Env)
		}
		return v, nil
	case ref.File != "":
		b, err := os.ReadFile(ref.File)
		if err != nil {
			return "", err
		}
		v := strings.TrimSpace(string(b))
		if v == "" {
			return "", errors.New(ref.File + " is empty")
		}
		return v, nil
	}
	return "", nil
}
