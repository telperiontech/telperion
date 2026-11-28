package httpserver

import (
	"context"
	"net"
	"net/http"
	"testing"
	"time"
)

func TestRunStopsOnContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- Run(ctx, time.Second, New("127.0.0.1:0", http.NotFoundHandler())) }()
	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("Run = %v, want nil after cancel", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("Run did not return after the context ended")
	}
}

func TestRunReportsListenError(t *testing.T) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	err = Run(context.Background(), time.Second, New(l.Addr().String(), http.NotFoundHandler()))
	if err == nil {
		t.Fatal("Run on a taken port returned nil")
	}
}
