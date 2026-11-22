package declare

import (
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/token"
)

// minSecretLen matches FRP_GATE_INSTANCE_KEY's rule; generated tokens are 55
// characters.
const minSecretLen = 32

var sha256Re = regexp.MustCompile(`^[0-9a-f]{64}$`)

// Env is where secrets referenced by the file are read from.
type Env struct {
	Getenv   func(string) string
	ReadFile func(string) ([]byte, error)
}

// OSEnv reads the process environment and the file system.
func OSEnv() Env { return Env{Getenv: os.Getenv, ReadFile: os.ReadFile} }

// secretHash resolves one of env / file / sha256 to the stored hash. It
// returns "" when none is set. The secret itself never leaves this function
// and is never part of an error message.
func secretHash(env Env, what, fromEnv, fromFile, sha string) (string, error) {
	set := 0
	for _, v := range []string{fromEnv, fromFile, sha} {
		if v != "" {
			set++
		}
	}
	switch {
	case set == 0:
		return "", nil
	case set > 1:
		return "", fmt.Errorf("%s: set only one of the _env, _file and _sha256 keys", what)
	}
	var secret string
	switch {
	case sha != "":
		h := strings.ToLower(strings.TrimSpace(sha))
		if !sha256Re.MatchString(h) {
			return "", fmt.Errorf("%s: sha256 must be 64 hex characters", what)
		}
		return h, nil
	case fromEnv != "":
		secret = strings.TrimSpace(env.Getenv(fromEnv))
		if secret == "" {
			return "", fmt.Errorf("%s: environment variable %s is not set", what, fromEnv)
		}
	default:
		b, err := env.ReadFile(fromFile)
		if err != nil {
			return "", fmt.Errorf("%s: cannot read %s: %v", what, fromFile, unwrapPathErr(err))
		}
		secret = strings.TrimSpace(string(b))
	}
	if len(secret) < minSecretLen {
		return "", fmt.Errorf("%s: the secret must be at least %d characters", what, minSecretLen)
	}
	return token.Hash(secret), nil
}

// unwrapPathErr drops the path (already in the message) from os errors.
func unwrapPathErr(err error) error {
	if pe, ok := err.(*os.PathError); ok {
		return pe.Err
	}
	return err
}
