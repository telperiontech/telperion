// Package audit carries who performs an action through a context, so the code
// that makes a change can record it in the service's audit log.
package audit

import "context"

// Actor is who performs an action: a source (e.g. "ui", "api", "apply") and a
// description such as the remote address or a config file path. Never a secret.
type Actor struct {
	Source string
	Who    string
}

type key struct{}

// WithActor returns a context carrying the actor.
func WithActor(ctx context.Context, a Actor) context.Context {
	return context.WithValue(ctx, key{}, a)
}

// From returns the actor of a context (Source "unknown" if none was set).
func From(ctx context.Context) Actor {
	if a, ok := ctx.Value(key{}).(Actor); ok {
		return a
	}
	return Actor{Source: "unknown"}
}
