package ingest

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"strings"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/secret"
	"github.com/telperiontech/telperion/apps/beacon/internal/store"
	"github.com/telperiontech/telperion/libs/go-kit/audit"
)

// CDEvents accepts CDEvents (cdevents.dev) as CloudEvents: structured
// (application/cloudevents+json), batched (application/cloudevents-batch+json)
// or binary (ce-type header, the CDEvent as body). Each source has its own
// bearer token. Events become observations; those that map to no package are
// recorded in the audit log as unmatched, so a misconfigured sender is
// visible.
type CDEvents struct {
	Store  *store.Store
	Ingest func([]model.Obs) error
	Log    *slog.Logger
}

// cloudEvent is the part of a CloudEvent Beacon reads.
type cloudEvent struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

// cdEvent is the part of a CDEvent Beacon reads.
type cdEvent struct {
	Context struct {
		Type      string    `json:"type"`
		Timestamp time.Time `json:"timestamp"`
	} `json:"context"`
	Subject struct {
		ID      string `json:"id"`
		Content struct {
			ArtifactID  string `json:"artifactId"`
			Environment struct {
				ID string `json:"id"`
			} `json:"environment"`
		} `json:"content"`
	} `json:"subject"`
}

// Result is the answer to a delivery.
type Result struct {
	Accepted  int      `json:"accepted"`
	Unmatched []string `json:"unmatched"`
}

func (h CDEvents) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	c, err := h.Store.LoadCatalog(r.Context())
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	src, ok := source(c, r.Header.Get("Authorization"))
	if !ok {
		http.Error(w, "unknown token", http.StatusUnauthorized)
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBody))
	if err != nil {
		http.Error(w, "body too large", http.StatusRequestEntityTooLarge)
		return
	}
	events, err := decode(r.Header, body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	res := Result{Unmatched: []string{}}
	var obs []model.Obs
	for _, ev := range events {
		o, err := Map(c, src, ev)
		if err != nil {
			res.Unmatched = append(res.Unmatched, err.Error())
			continue
		}
		obs = append(obs, o)
	}
	if len(obs) > 0 {
		if err := h.Ingest(obs); err != nil {
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
			return
		}
	}
	res.Accepted = len(obs)
	actx := audit.WithActor(r.Context(), audit.Actor{Source: "cdevents", Who: src.Name})
	for _, u := range res.Unmatched {
		_ = h.Store.Audit(actx, "cdevents.unmatched", "source "+src.Name, u)
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(res)
}

// source finds the sender by its bearer token (compared in constant time).
func source(c catalog.Catalog, auth string) (catalog.CDEventsSource, bool) {
	tok, ok := strings.CutPrefix(auth, "Bearer ")
	if !ok || tok == "" {
		return catalog.CDEventsSource{}, false
	}
	for _, s := range c.CDEvents {
		if want, err := secret.Value(s.Token); err == nil && secret.TokenEqual(tok, want) {
			return s, true
		}
	}
	return catalog.CDEventsSource{}, false
}

// decode reads the CDEvents of a delivery in any of the three modes.
func decode(h http.Header, body []byte) ([]cdEvent, error) {
	ct, _, _ := mime.ParseMediaType(h.Get("Content-Type"))
	var ces []cloudEvent
	switch {
	case ct == "application/cloudevents-batch+json":
		if err := json.Unmarshal(body, &ces); err != nil {
			return nil, fmt.Errorf("a CloudEvents batch: %w", err)
		}
	case ct == "application/cloudevents+json":
		var ce cloudEvent
		if err := json.Unmarshal(body, &ce); err != nil {
			return nil, fmt.Errorf("a structured CloudEvent: %w", err)
		}
		ces = []cloudEvent{ce}
	case h.Get("Ce-Type") != "":
		ces = []cloudEvent{{Type: h.Get("Ce-Type"), Data: body}}
	default:
		return nil, errors.New("send a CloudEvent: structured (application/cloudevents+json), batched, or binary (ce-* headers)")
	}
	out := make([]cdEvent, 0, len(ces))
	for _, ce := range ces {
		var ev cdEvent
		if err := json.Unmarshal(ce.Data, &ev); err != nil {
			return nil, fmt.Errorf("the data of %s is not a CDEvent: %w", ce.Type, err)
		}
		if ev.Context.Type == "" {
			ev.Context.Type = ce.Type
		}
		out = append(out, ev)
	}
	return out, nil
}

// Map turns one CDEvent into an observation of a package version, or says
// why it cannot.
func Map(c catalog.Catalog, src catalog.CDEventsSource, ev cdEvent) (model.Obs, error) {
	subject, predicate := kind(ev.Context.Type)
	o := model.Obs{At: ev.Context.Timestamp}
	artifact := ev.Subject.Content.ArtifactID
	switch subject + "." + predicate {
	case "artifact.packaged":
		o.Stage, o.State, artifact = model.Published, model.Pending, ev.Subject.ID
	case "artifact.published":
		o.Stage, o.State, artifact = model.Published, model.OK, ev.Subject.ID
	case "build.started":
		o.Stage, o.State = model.Built, model.Pending
	case "build.finished":
		o.Stage, o.State = model.Built, model.OK
	case "service.deployed", "service.upgraded", "service.rolledback":
		o.Stage, o.State, o.Target, o.Exclusive = model.Deployed, model.OK, ev.Subject.Content.Environment.ID, true
	case "change.merged", "branch.created", "branch.deleted", "change.created", "change.updated", "change.reviewed", "change.abandoned":
		return o, fmt.Errorf("%s: outside the release chain, ignored", ev.Context.Type)
	default:
		return o, fmt.Errorf("%s: not mapped to a stage", ev.Context.Type)
	}
	if artifact == "" {
		return o, fmt.Errorf("%s: no artifact id (purl)", ev.Context.Type)
	}
	p, version, err := resolvePURL(c, artifact)
	if err != nil {
		return o, fmt.Errorf("%s %s: %w", ev.Context.Type, artifact, err)
	}
	switch {
	case !src.Allows(p.Name):
		return o, fmt.Errorf("%s: source %s may not report on %s", ev.Context.Type, src.Name, p.Name)
	case o.Stage == model.Built && p.CI == nil,
		o.Stage == model.Published && p.Artifact == nil:
		return o, fmt.Errorf("%s: %s has no %s stage", ev.Context.Type, p.Name, o.Stage)
	case o.Stage == model.Deployed:
		if _, ok := p.DeployTo(o.Target); !ok {
			return o, fmt.Errorf("%s: %s has no deploy target %q", ev.Context.Type, p.Name, o.Target)
		}
	}
	o.Package, o.Version, o.Detail = p.Name, version, "cdevents: "+src.Name
	return o, nil
}

// kind splits dev.cdevents.<subject>.<predicate>.<version>.
func kind(t string) (subject, predicate string) {
	parts := strings.Split(strings.TrimPrefix(t, "dev.cdevents."), ".")
	if len(parts) < 2 {
		return "", ""
	}
	return parts[0], parts[1]
}

// resolvePURL maps an artifact id to a package and version through the
// artifact coordinates in the config: npm by package name, oci by
// repository (the repository_url qualifier) and the tag qualifier, generic
// by Beacon's package name.
func resolvePURL(c catalog.Catalog, s string) (catalog.Package, string, error) {
	u, err := ParsePURL(s)
	if err != nil {
		return catalog.Package{}, "", err
	}
	version := u.Version
	match := func(p catalog.Package) bool { return false }
	switch u.Type {
	case "npm":
		match = func(p catalog.Package) bool {
			return p.Artifact != nil && p.Artifact.NPM != nil && p.Artifact.NPM.Name == u.FullName()
		}
	case "oci", "docker":
		repo := u.Qualifiers.Get("repository_url")
		if tag := u.Qualifiers.Get("tag"); tag != "" || strings.HasPrefix(version, "sha256:") {
			version = tag
		}
		match = func(p catalog.Package) bool {
			if p.Artifact == nil || p.Artifact.OCI == nil {
				return false
			}
			full := p.Artifact.OCI.Registry + "/" + p.Artifact.OCI.Name
			if repo != "" {
				return full == strings.TrimSuffix(repo, "/")+"/"+u.Name
			}
			return strings.HasSuffix(full, "/"+u.FullName())
		}
	case "generic":
		match = func(p catalog.Package) bool { return p.Name == u.FullName() }
	default:
		return catalog.Package{}, "", fmt.Errorf("purl type %q is not mapped (npm, oci, generic)", u.Type)
	}
	version = strings.TrimPrefix(version, "v")
	if version == "" {
		return catalog.Package{}, "", errors.New("no version (purl version or tag qualifier)")
	}
	for _, p := range c.Packages {
		if match(p) {
			return p, version, nil
		}
	}
	return catalog.Package{}, "", errors.New("no package has this artifact")
}
