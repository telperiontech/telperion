// Command fakeplatform impersonates every platform Beacon reads, for the RSS
// check (test/rss): git smart HTTP, the GitHub App and Actions APIs, an npm
// registry, an OCI registry, Coolify and http-check endpoints, all on one
// listener (and the writes of plans, see writes.go), over a synthetic catalog of ~30 packages whose versions keep
// moving through their chains.
//
// At start it writes a GitHub App private key and a Beacon config for this
// catalog into -out, so Beacon needs nothing else.
package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

func main() {
	addr := flag.String("addr", ":8080", "listen address")
	base := flag.String("base", "http://fake:8080", "URL Beacon reaches this server at")
	out := flag.String("out", "/shared", "directory for app.pem and beacon.yaml")
	period := flag.Duration("period", time.Minute, "a new version of each package every period")
	flag.Parse()

	if err := writeFiles(*out, *base); err != nil {
		log.Fatal(err)
	}
	w := world{start: time.Now(), period: *period, now: time.Now}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(rw http.ResponseWriter, _ *http.Request) { _, _ = rw.Write([]byte("ok\n")) })
	routeGit(mux, w)
	routeGitHub(mux, w)
	routeCompare(mux)
	routeWrites(mux, *base)
	routeCoolifyDeploys(mux)
	routeNPM(mux, w)
	routeOCI(mux, w)
	routeRuntime(mux, w)
	log.Printf("fakeplatform on %s, %d packages", *addr, len(catalog()))
	log.Fatal(http.ListenAndServe(*addr, mux))
}

func writeFiles(dir, base string) error {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return err
	}
	pemBytes := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})
	if err := os.WriteFile(filepath.Join(dir, "app.pem"), pemBytes, 0o644); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "beacon.yaml"), []byte(config(base, filepath.Join(dir, "app.pem"))), 0o644)
}

// writeJSON answers like GitHub and registries do: with an ETag, and 304 when
// the client already has it.
func writeJSON(rw http.ResponseWriter, r *http.Request, v any) {
	b, err := json.Marshal(v)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
	sum := sha256.Sum256(b)
	etag := `"` + hex.EncodeToString(sum[:8]) + `"`
	rw.Header().Set("ETag", etag)
	if r.Header.Get("If-None-Match") == etag {
		rw.WriteHeader(http.StatusNotModified)
		return
	}
	rw.Header().Set("Content-Type", "application/json")
	_, _ = rw.Write(b)
}
