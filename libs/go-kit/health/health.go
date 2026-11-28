// Package health implements a service's /healthz endpoint and the healthcheck
// subcommand that distroless images use for HEALTHCHECK (no curl there).
package health

import (
	"context"
	"net"
	"net/http"
	"time"
)

// Handler answers 200 "ok" while ping succeeds (nil ping: always) and 503
// otherwise.
func Handler(ping func(context.Context) error) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if ping != nil {
			if err := ping(r.Context()); err != nil {
				http.Error(w, "unhealthy", http.StatusServiceUnavailable)
				return
			}
		}
		_, _ = w.Write([]byte("ok\n"))
	})
}

// Check asks http://127.0.0.1:<port of addr>/healthz and returns the exit code
// for the healthcheck subcommand: 0 healthy, 1 otherwise.
func Check(addr string) int {
	_, port, err := net.SplitHostPort(addr)
	if err != nil {
		return 1
	}
	c := http.Client{Timeout: 3 * time.Second}
	resp, err := c.Get("http://127.0.0.1:" + port + "/healthz")
	if err != nil {
		return 1
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}
