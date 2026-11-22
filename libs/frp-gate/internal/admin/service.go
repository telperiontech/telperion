package admin

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strconv"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/audit"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// inputError is a user mistake (HTTP 400), as opposed to a server failure.
type inputError struct{ msg string }

func (e inputError) Error() string { return e.msg }

func badInput(format string, args ...any) error { return inputError{fmt.Sprintf(format, args...)} }

// ManagedError refuses a change to an object owned by the config file
// (HTTP 409). It is changed by editing the file and running apply.
type ManagedError struct{ Kind, Name, What string }

func (e ManagedError) Error() string {
	what := e.What
	if what == "" {
		what = "changed"
	}
	return fmt.Sprintf("%s %s is managed by the config file and cannot be %s here; edit the file and apply it",
		e.Kind, e.Name, what)
}

// Service holds the admin operations shared by the web UI and the JSON API.
// Everything is addressed by name, which keeps the API easy to script.
type Service struct {
	Store *store.Store
	Log   *slog.Logger // optional; audit write failures are logged here
}

func notFoundAsInput(err error, kind, name string) error {
	if errors.Is(err, store.ErrNotFound) {
		return badInput("unknown %s %q", kind, name)
	}
	return err
}

func itoa(i int64) string { return strconv.FormatInt(i, 10) }

// record writes an audit entry for a successful action. The actor comes
// from the context (audit.WithActor). detail must never hold a secret.
func (s *Service) record(ctx context.Context, action, object, detail string) {
	a := audit.From(ctx)
	err := s.Store.AddAudit(ctx, store.AuditEntry{Source: a.Source, Actor: a.Who, Action: action, Object: object, Detail: detail})
	if err != nil && s.Log != nil {
		s.Log.Warn("audit log write failed", "action", action, "err", err)
	}
}
