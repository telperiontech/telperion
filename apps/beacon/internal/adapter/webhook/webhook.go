// Package webhook starts a release on any system: it POSTs the release
// request as JSON to a configured URL, signed with HMAC-SHA256 like GitHub's
// webhooks (X-Beacon-Signature-256: sha256=<hex>). The receiver creates the
// tag; Beacon follows the release through the chain or through CDEvents.
package webhook

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
	"github.com/telperiontech/telperion/apps/beacon/internal/secret"
)

// Trigger implements adapter.Trigger.
type Trigger struct {
	Client *platform.Client
}

var _ adapter.Trigger = Trigger{}

// Payload is the JSON body a receiver gets.
type Payload struct {
	Event   string `json:"event"` // "release"
	Package string `json:"package"`
	Version string `json:"version"`
	Tag     string `json:"tag"`
	Bump    string `json:"bump,omitempty"`
	Branch  string `json:"branch,omitempty"`
	Commit  string `json:"commit,omitempty"`
	Plan    int64  `json:"plan"`
}

// Describe says what Fire does.
func (t Trigger) Describe(req adapter.ReleaseRequest) string {
	host := ""
	if u, err := url.Parse(req.Package.Release.Webhook.URL); err == nil {
		host = u.Host
	}
	return fmt.Sprintf("POST the release of %s (tag %s) to %s", req.Version, req.Tag, host)
}

// Fire sends the signed request. The delivery id (X-Beacon-Delivery) is the
// same for a retried step, so a receiver can drop duplicates.
func (t Trigger) Fire(ctx context.Context, req adapter.ReleaseRequest) (adapter.Fired, error) {
	if req.Package.Release == nil || req.Package.Release.Webhook == nil {
		return adapter.Fired{}, errors.New("not a webhook package")
	}
	hook := req.Package.Release.Webhook
	key, err := secret.Value(hook.Secret)
	if err != nil {
		return adapter.Fired{}, err
	}
	body, err := json.Marshal(Payload{
		Event: "release", Package: req.Package.Name, Version: req.Version, Tag: req.Tag, Bump: req.Bump,
		Branch: req.Branch, Commit: req.Commit, Plan: req.Plan,
	})
	if err != nil {
		return adapter.Fired{}, err
	}
	h := http.Header{}
	h.Set("Content-Type", "application/json")
	h.Set("X-Beacon-Event", "release")
	h.Set("X-Beacon-Delivery", fmt.Sprintf("%d-%s-%s", req.Plan, req.Package.Name, req.Version))
	h.Set("X-Beacon-Signature-256", secret.Sign([]byte(key), body))
	err = t.Client.Do(ctx, platform.Request{Method: http.MethodPost, URL: hook.URL, Header: h, Body: bytes.NewReader(body)},
		func(resp *http.Response) error { _, err := io.Copy(io.Discard, resp.Body); return err })
	return adapter.Fired{Detail: "sent the release request"}, err
}
