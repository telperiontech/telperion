// Package audit carries who performs an admin action through a context, so
// the code that makes the change can record it in the audit log.
package audit

import "context"

// Sources of admin actions.
const (
	SourceUI    = "ui"
	SourceAPI   = "api"
	SourceApply = "apply" // frp-gate apply
	SourceStart = "start" // FRP_GATE_CONFIG / FRP_GATE_INSTANCE_KEY at start-up
)

// Actor is who performs an action: a source and a description such as the
// remote address or the config file path. Never a secret.
type Actor struct {
	Source string
	Who    string
}

type key struct{}

// WithActor returns a context carrying the actor.
func WithActor(ctx context.Context, a Actor) context.Context {
	return context.WithValue(ctx, key{}, a)
}

// From returns the actor of a context ("unknown" if none was set).
func From(ctx context.Context) Actor {
	if a, ok := ctx.Value(key{}).(Actor); ok {
		return a
	}
	return Actor{Source: "unknown"}
}
