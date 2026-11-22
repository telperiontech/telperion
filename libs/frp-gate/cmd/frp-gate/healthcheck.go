package main

import (
	"net"
	"net/http"
	"os"
	"time"
)

// healthcheck is used by the image's HEALTHCHECK (no curl in distroless).
func healthcheck() int {
	addr := os.Getenv("FRP_GATE_INTERNAL_ADDR")
	if addr == "" {
		addr = ":7600"
	}
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
