package main

import (
	"testing"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/declare"
)

func TestConfigIsValidForBeacon(t *testing.T) {
	f, err := declare.Parse([]byte(config("http://fake:8080", "/shared/app.pem")))
	if err != nil {
		t.Fatal(err)
	}
	c, err := f.Resolve(declare.Env{
		Getenv:   func(k string) string { return map[string]string{"COOLIFY_TOKEN": "x"}[k] },
		ReadFile: func(string) ([]byte, error) { return []byte("key"), nil },
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(c.Packages) != len(catalog()) {
		t.Errorf("packages = %d, want %d", len(c.Packages), len(catalog()))
	}
}

func TestTimeline(t *testing.T) {
	start := time.Now()
	now := start
	w := world{start: start, period: time.Minute, now: func() time.Time { return now }}
	p := catalog()[0]
	if got := len(w.versions(p)); got != p.base {
		t.Fatalf("versions at start = %d, want %d", got, p.base)
	}
	now = start.Add(5 * time.Minute)
	if got := len(w.versions(p)); got <= p.base {
		t.Errorf("no new versions after five minutes (%d)", got)
	}
	if _, ok := w.running(catalog()[20]); !ok {
		t.Error("an image service runs nothing")
	}
}
