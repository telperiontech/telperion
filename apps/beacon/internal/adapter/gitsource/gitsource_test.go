package gitsource

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
)

func pkt(s string) string { return fmt.Sprintf("%04x%s", len(s)+4, s) }

const (
	shaMain = "1111111111111111111111111111111111111111"
	shaTag  = "2222222222222222222222222222222222222222"
	shaObj  = "3333333333333333333333333333333333333333"
)

func advertisement() string {
	return pkt("# service=git-upload-pack\n") + "0000" +
		pkt(shaMain+" HEAD\x00multi_ack thin-pack symref=HEAD:refs/heads/main\n") +
		pkt(shaMain+" refs/heads/main\n") +
		pkt(shaTag+" refs/tags/js-utils-v1.0.0\n") +
		pkt(shaObj+" refs/tags/js-utils-v1.1.0\n") +
		pkt(shaTag+" refs/tags/js-utils-v1.1.0^{}\n") +
		"0000"
}

func TestParseAdvertisement(t *testing.T) {
	refs, err := ParseAdvertisement(strings.NewReader(advertisement()))
	if err != nil {
		t.Fatal(err)
	}
	want := []adapter.Tag{{Name: "js-utils-v1.0.0", Commit: shaTag}, {Name: "js-utils-v1.1.0", Commit: shaTag}}
	if tags := refs.Tags; fmt.Sprint(tags) != fmt.Sprint(want) {
		t.Errorf("tags = %v, want %v (annotated tags peeled)", tags, want)
	}
	if name, sha, ok := refs.Head(""); !ok || name != "main" || sha != shaMain {
		t.Errorf("default head = %q %q %v", name, sha, ok)
	}
	if _, err := ParseAdvertisement(strings.NewReader("<html>")); err == nil {
		t.Error("an HTML page parsed as refs")
	}
}

type fixedToken string

func (f fixedToken) Token(context.Context, string) (string, error)      { return string(f), nil }
func (f fixedToken) WriteToken(context.Context, string) (string, error) { return string(f), nil }

func TestRefsUsesAppToken(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, pass, _ := r.BasicAuth()
		if r.URL.Path != "/acme/app.git/info/refs" || r.URL.Query().Get("service") != "git-upload-pack" ||
			user != "x-access-token" || pass != "ghs_x" {
			http.Error(w, "no", http.StatusUnauthorized)
			return
		}
		_, _ = w.Write([]byte(advertisement()))
	}))
	defer srv.Close()
	s := Source{Client: platform.New("test", 5*time.Second), GitHub: fixedToken("ghs_x")}
	refs, err := s.Refs(context.Background(), catalog.Repo{GitHub: "acme/app", URL: srv.URL + "/acme/app.git"})
	if err != nil || len(refs.Tags) != 2 {
		t.Fatalf("refs = %v %v", refs, err)
	}
}
