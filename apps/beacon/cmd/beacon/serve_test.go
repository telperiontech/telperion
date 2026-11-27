package main

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestReadListenEnv(t *testing.T) {
	env, err := readListenEnv(func(string) string { return "" })
	if err != nil {
		t.Fatal(err)
	}
	if env.IngestAddr != ":7700" || env.AdminAddr != ":7701" || env.LogLevel != slog.LevelInfo {
		t.Errorf("defaults = %+v", env)
	}

	set := map[string]string{"BEACON_INGEST_ADDR": " :1 ", "BEACON_ADMIN_ADDR": ":2", "BEACON_LOG_LEVEL": "debug"}
	env, err = readListenEnv(func(k string) string { return set[k] })
	if err != nil {
		t.Fatal(err)
	}
	if env.IngestAddr != ":1" || env.AdminAddr != ":2" || env.LogLevel != slog.LevelDebug {
		t.Errorf("overrides = %+v", env)
	}

	if _, err := readListenEnv(func(k string) string { return map[string]string{"BEACON_LOG_LEVEL": "loud"}[k] }); err == nil {
		t.Error("an unknown log level was accepted")
	}
}

func TestIngestHealthz(t *testing.T) {
	rec := httptest.NewRecorder()
	ingestHandler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if rec.Code != http.StatusOK || rec.Body.String() != "ok\n" {
		t.Fatalf("GET /healthz = %d %q", rec.Code, rec.Body.String())
	}

	rec = httptest.NewRecorder()
	ingestHandler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Code != http.StatusNotFound {
		t.Errorf("the ingest listener serves %d on /, want 404 (the UI is admin-only)", rec.Code)
	}
}

func TestHealthcheck(t *testing.T) {
	srv := httptest.NewServer(ingestHandler())
	defer srv.Close()
	addr := srv.Listener.Addr().String()
	if code := healthcheck(func(k string) string { return map[string]string{"BEACON_INGEST_ADDR": addr}[k] }); code != 0 {
		t.Errorf("healthcheck against a healthy server = %d, want 0", code)
	}
	if code := healthcheck(func(k string) string { return map[string]string{"BEACON_INGEST_ADDR": "no-port"}[k] }); code != 1 {
		t.Errorf("healthcheck with an invalid address = %d, want 1", code)
	}
}
