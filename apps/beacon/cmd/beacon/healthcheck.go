package main

import (
	"net"
	"net/http"
	"time"
)

// healthcheck is used by the image's HEALTHCHECK (no curl in distroless).
// It asks the ingest listener's /healthz on the loopback interface.
func healthcheck(getenv func(string) string) int {
	env, err := readListenEnv(getenv)
	if err != nil {
		return 1
	}
	_, port, err := net.SplitHostPort(env.IngestAddr)
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
