package secret

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
)

func TestGitHubAppToken(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	keyFile := filepath.Join(t.TempDir(), "app.pem")
	pemBytes := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})
	if err := os.WriteFile(keyFile, pemBytes, 0o600); err != nil {
		t.Fatal(err)
	}

	mints := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !validJWT(r.Header.Get("Authorization"), &key.PublicKey) {
			http.Error(w, "bad jwt", http.StatusUnauthorized)
			return
		}
		switch r.URL.Path {
		case "/repos/acme/app/installation":
			_, _ = w.Write([]byte(`{"id": 42}`))
		case "/app/installations/42/access_tokens":
			var body struct{ Permissions map[string]string }
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body.Permissions["contents"] != "read" {
				http.Error(w, "unexpected permissions", http.StatusUnprocessableEntity)
				return
			}
			mints++
			_ = json.NewEncoder(w).Encode(map[string]any{"token": "ghs_test", "expires_at": time.Now().Add(time.Hour)})
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	app, err := NewGitHubApp(catalog.GitHubApp{AppID: 7, APIURL: srv.URL, PrivateKey: catalog.SecretRef{File: keyFile}},
		platform.New("test", 5*time.Second), ReadPermissions)
	if err != nil {
		t.Fatal(err)
	}
	for range 3 {
		tok, err := app.Token(context.Background(), "acme/app")
		if err != nil || tok != "ghs_test" {
			t.Fatalf("token = %q %v", tok, err)
		}
	}
	if mints != 1 {
		t.Errorf("minted %d tokens, want 1 (cached)", mints)
	}
}

func validJWT(auth string, pub *rsa.PublicKey) bool {
	parts := strings.Split(strings.TrimPrefix(auth, "Bearer "), ".")
	if len(parts) != 3 {
		return false
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return false
	}
	sum := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	return rsa.VerifyPKCS1v15(pub, crypto.SHA256, sum[:], sig) == nil
}
