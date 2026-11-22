// Package policy decides what frps should allow. It is independent of HTTP:
// the plugin and ask handlers translate requests into calls here.
package policy

import (
	"fmt"
	"log/slog"
	"time"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// TLS ask modes.
const (
	// AskClaimed approves a name only if it is granted to an enabled client
	// and that client claimed it (in an accepted proxy) within the retention
	// window. This keeps random names from burning ACME rate limits.
	AskClaimed = "claimed"
	// AskGranted approves any name granted to an enabled client.
	AskGranted = "granted"
)

// Decision is the answer to one frps plugin operation.
type Decision struct {
	Allow  bool
	Reason string // for frpc and the log; may name clients and hosts
	Code   string // short and fixed, for metrics labels (e.g. "bad_token")
}

func allow() Decision { return Decision{Allow: true} }

func deny(code, format string, args ...any) Decision {
	return Decision{Reason: fmt.Sprintf(format, args...), Code: code}
}

// Policy holds what decisions depend on.
type Policy struct {
	Store          *store.Store
	AskMode        string
	ClaimRetention time.Duration
	Log            *slog.Logger
	Now            func() time.Time
}

// New returns a Policy with defaults for unset fields.
func New(s *store.Store, askMode string, retention time.Duration, log *slog.Logger) *Policy {
	if askMode == "" {
		askMode = AskClaimed
	}
	if log == nil {
		log = slog.Default()
	}
	return &Policy{Store: s, AskMode: askMode, ClaimRetention: retention, Log: log, Now: time.Now}
}
