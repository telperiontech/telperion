// Package httpserver runs a service's HTTP listeners side by side and shuts
// them down together.
package httpserver

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"
)

// New returns a server with conservative timeouts for an admin or API listener.
// Streaming handlers (SSE) clear the write deadline per request with
// http.ResponseController.
func New(addr string, h http.Handler) *http.Server {
	return &http.Server{
		Addr: addr, Handler: h,
		ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 30 * time.Second,
		WriteTimeout: 30 * time.Second, IdleTimeout: 2 * time.Minute,
	}
}

// Run serves every server until ctx ends or one of them fails, then shuts all
// of them down (waiting up to grace) and returns the failure, if any.
func Run(ctx context.Context, grace time.Duration, servers ...*http.Server) error {
	errc := make(chan error, len(servers))
	for _, s := range servers {
		go func() {
			if err := s.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				errc <- fmt.Errorf("listen %s: %w", s.Addr, err)
			}
		}()
	}
	var err error
	select {
	case <-ctx.Done():
	case err = <-errc:
	}
	shutdown, cancel := context.WithTimeout(context.Background(), grace)
	defer cancel()
	for _, s := range servers {
		_ = s.Shutdown(shutdown)
	}
	return err
}
