package admin

import (
	"errors"
	"fmt"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// inputError is a user mistake (HTTP 400), as opposed to a server failure.
type inputError struct{ msg string }

func (e inputError) Error() string { return e.msg }

func badInput(format string, args ...any) error { return inputError{fmt.Sprintf(format, args...)} }

// Service holds the admin operations shared by the web UI and the JSON API.
// Everything is addressed by name, which keeps the API easy to script.
type Service struct {
	Store *store.Store
}

func notFoundAsInput(err error, kind, name string) error {
	if errors.Is(err, store.ErrNotFound) {
		return badInput("unknown %s %q", kind, name)
	}
	return err
}
