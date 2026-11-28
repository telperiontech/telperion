// Package oci reports the published versions of an image on a
// distribution-spec registry (ghcr.io, Docker Hub, Harbor, ...): its tags,
// paginated, through the registry's bearer token flow. For the newest version
// it checks that every expected platform (linux/amd64, linux/arm64, ...) is in
// the image index.
package oci

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"sync"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
	"github.com/telperiontech/telperion/apps/beacon/internal/semver"
)

// maxPages bounds pagination of a tag list (1000 tags per page).
const maxPages = 20

// Artifact implements adapter.Artifact. Use one value (it remembers the
// platform check of each package's newest version).
type Artifact struct {
	Client *platform.Client

	mu      sync.Mutex
	checked map[string]platformCheck // package → newest version's check
}

var _ adapter.Artifact = (*Artifact)(nil)

type platformCheck struct {
	version string
	missing []string
}

// Versions lists the image's version tags ("1.2.3" or "v1.2.3").
func (a *Artifact) Versions(ctx context.Context, pkg catalog.Package) ([]model.Obs, error) {
	if pkg.Artifact == nil || pkg.Artifact.OCI == nil {
		return nil, nil
	}
	o := pkg.Artifact.OCI
	reg := registry{client: a.Client, o: o}
	tags, err := reg.tags(ctx)
	if err != nil {
		return nil, err
	}
	var out []model.Obs
	newest := ""
	for _, t := range tags {
		v := strings.TrimPrefix(t, "v")
		if _, ok := semver.Parse(v); !ok {
			continue
		}
		out = append(out, model.Obs{Package: pkg.Name, Version: v, Stage: model.Published, State: model.OK, URL: pageURL(o, t)})
		if newest == "" || semver.CompareStrings(v, strings.TrimPrefix(newest, "v")) > 0 {
			newest = t
		}
	}
	if newest == "" || len(o.Platforms) == 0 {
		return out, nil
	}
	missing, err := a.missingPlatforms(ctx, reg, pkg.Name, newest)
	if err != nil {
		return nil, err
	}
	if len(missing) > 0 {
		for i := range out {
			if out[i].Version == strings.TrimPrefix(newest, "v") {
				out[i].State, out[i].Detail = model.Failed, "missing "+strings.Join(missing, ", ")
			}
		}
	}
	return out, nil
}

func (a *Artifact) missingPlatforms(ctx context.Context, reg registry, pkg, tag string) ([]string, error) {
	a.mu.Lock()
	c, ok := a.checked[pkg]
	a.mu.Unlock()
	if ok && c.version == tag {
		return c.missing, nil
	}
	have, err := reg.platforms(ctx, tag)
	if err != nil {
		return nil, err
	}
	var missing []string
	for _, p := range reg.o.Platforms {
		if !have[p] {
			missing = append(missing, p)
		}
	}
	a.mu.Lock()
	if a.checked == nil {
		a.checked = map[string]platformCheck{}
	}
	a.checked[pkg] = platformCheck{version: tag, missing: missing}
	a.mu.Unlock()
	return missing, nil
}

func pageURL(o *catalog.OCI, tag string) string {
	if o.Registry == "registry-1.docker.io" {
		return "https://hub.docker.com/r/" + strings.TrimPrefix(o.Name, "library/") + "/tags?name=" + tag
	}
	return ""
}

// registry talks to one repository of a registry.
type registry struct {
	client *platform.Client
	o      *catalog.OCI
	token  string
}

func (r *registry) base() string {
	scheme := "https"
	if r.o.Insecure {
		scheme = "http"
	}
	return scheme + "://" + r.o.Registry + "/v2/" + r.o.Name
}

var nextLink = regexp.MustCompile(`<([^>]+)>;\s*rel="?next"?`)

func (r *registry) tags(ctx context.Context) ([]string, error) {
	var all []string
	next := r.base() + "/tags/list?n=1000"
	for page := 0; next != "" && page < maxPages; page++ {
		var body struct {
			Tags []string `json:"tags"`
		}
		var link string
		err := r.get(ctx, next, "application/json", func(resp *http.Response) error {
			link = resp.Header.Get("Link")
			return json.NewDecoder(resp.Body).Decode(&body)
		})
		if err != nil {
			return nil, err
		}
		all = append(all, body.Tags...)
		next = ""
		if m := nextLink.FindStringSubmatch(link); m != nil {
			next = m[1]
			if strings.HasPrefix(next, "/") {
				next = strings.SplitN(r.base(), "/v2/", 2)[0] + next
			}
		}
	}
	return all, nil
}

const manifestTypes = "application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, " +
	"application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json"

// platforms lists the os/arch[/variant] entries of a tag's image index. A
// single-platform manifest has none.
func (r *registry) platforms(ctx context.Context, tag string) (map[string]bool, error) {
	var idx struct {
		Manifests []struct {
			Platform struct {
				OS           string `json:"os"`
				Architecture string `json:"architecture"`
				Variant      string `json:"variant"`
			} `json:"platform"`
		} `json:"manifests"`
	}
	err := r.get(ctx, r.base()+"/manifests/"+tag, manifestTypes, func(resp *http.Response) error {
		return json.NewDecoder(resp.Body).Decode(&idx)
	})
	if err != nil {
		return nil, err
	}
	have := map[string]bool{}
	for _, m := range idx.Manifests {
		p := m.Platform.OS + "/" + m.Platform.Architecture
		if p == "unknown/unknown" { // attestation manifests
			continue
		}
		have[p] = true
		if m.Platform.Variant != "" {
			have[p+"/"+m.Platform.Variant] = true
		}
	}
	return have, nil
}

// get sends a GET with the registry token, fetching one on the first 401.
func (r *registry) get(ctx context.Context, u, accept string, read func(*http.Response) error) error {
	do := func() error {
		h := http.Header{}
		h.Set("Accept", accept)
		if r.token != "" {
			h.Set("Authorization", "Bearer "+r.token)
		}
		return r.client.Do(ctx, platform.Request{URL: u, Header: h}, read)
	}
	err := do()
	var se *platform.StatusError
	if !asStatus(err, &se) || se.Code != http.StatusUnauthorized || r.token != "" {
		return err
	}
	if r.token, err = r.fetchToken(ctx, se.Header.Get("WWW-Authenticate")); err != nil {
		return fmt.Errorf("registry token: %w", err)
	}
	return do()
}
