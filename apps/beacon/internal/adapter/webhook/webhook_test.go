package webhook

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
	"github.com/telperiontech/telperion/apps/beacon/internal/secret"
)

func TestFireSigns(t *testing.T) {
	t.Setenv("HOOK_TEST_SECRET", "s3cret")
	var got Payload
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		if !secret.Verify([]byte("s3cret"), body, r.Header.Get("X-Beacon-Signature-256")) {
			http.Error(w, "bad signature", http.StatusUnauthorized)
			return
		}
		_ = json.Unmarshal(body, &got)
		w.WriteHeader(http.StatusAccepted)
	}))
	defer srv.Close()
	pkg := catalog.Package{Name: "site", Release: &catalog.Release{
		Webhook: &catalog.Webhook{URL: srv.URL + "/release", Secret: catalog.SecretRef{Env: "HOOK_TEST_SECRET"}},
	}}
	_, err := Trigger{Client: platform.New("t", 5*time.Second)}.Fire(context.Background(),
		adapter.ReleaseRequest{Package: pkg, Version: "1.3.0", Tag: "v1.3.0", Bump: "minor", Plan: 7})
	if err != nil {
		t.Fatal(err)
	}
	if got.Event != "release" || got.Package != "site" || got.Version != "1.3.0" || got.Plan != 7 {
		t.Errorf("payload = %+v", got)
	}
}
