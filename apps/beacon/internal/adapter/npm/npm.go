// Package npm reports the published versions of a package on an
// npm-compatible registry (npmjs.org, Verdaccio, GitHub Packages, ...). The
// packument of a long-lived package is several MB, so it is decoded as a
// stream and only the version names and their publish times are kept.
package npm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
	"github.com/telperiontech/telperion/apps/beacon/internal/secret"
)

// Artifact implements adapter.Artifact.
type Artifact struct {
	Client *platform.Client
}

var _ adapter.Artifact = Artifact{}

// Versions lists the published versions.
func (a Artifact) Versions(ctx context.Context, pkg catalog.Package) ([]model.Obs, error) {
	if pkg.Artifact == nil || pkg.Artifact.NPM == nil {
		return nil, nil
	}
	n := pkg.Artifact.NPM
	h := http.Header{}
	h.Set("Accept", "application/json")
	tok, err := secret.Value(n.Token)
	if err != nil {
		return nil, err
	}
	if tok != "" {
		h.Set("Authorization", "Bearer "+tok)
	}
	u := n.Registry + "/" + strings.Replace(n.Name, "/", "%2F", 1)
	var versions []string
	var times map[string]time.Time
	err = a.Client.Do(ctx, platform.Request{URL: u, Header: h, Conditional: true, ETagKey: pkg.Name + " " + u},
		func(resp *http.Response) error {
			var err error
			versions, times, err = Decode(resp.Body)
			return err
		})
	if err != nil {
		return nil, err
	}
	out := make([]model.Obs, 0, len(versions))
	for _, v := range versions {
		out = append(out, model.Obs{
			Package: pkg.Name, Version: v, Stage: model.Published, State: model.OK, At: times[v],
			URL: pageURL(n, v),
		})
	}
	return out, nil
}

func pageURL(n *catalog.NPM, version string) string {
	if n.Registry != "https://registry.npmjs.org" {
		return ""
	}
	return "https://www.npmjs.com/package/" + n.Name + "/v/" + version
}

// Decode reads a packument and returns the keys of "versions" (unpublished
// versions are gone from it) and the publish times from "time". Everything
// else, including each version's manifest and the readme, is skipped token by
// token without being kept.
func Decode(r io.Reader) ([]string, map[string]time.Time, error) {
	dec := json.NewDecoder(r)
	if err := expectDelim(dec, '{'); err != nil {
		return nil, nil, err
	}
	var versions []string
	times := map[string]time.Time{}
	for dec.More() {
		key, err := dec.Token()
		if err != nil {
			return nil, nil, err
		}
		switch key {
		case "versions":
			if versions, err = objectKeys(dec); err != nil {
				return nil, nil, err
			}
		case "time":
			var raw map[string]string
			if err := dec.Decode(&raw); err != nil {
				return nil, nil, err
			}
			for v, s := range raw {
				if t, err := time.Parse(time.RFC3339, s); err == nil {
					times[v] = t
				}
			}
		default:
			if err := skip(dec); err != nil {
				return nil, nil, err
			}
		}
	}
	return versions, times, nil
}

// objectKeys reads an object's keys and skips its values.
func objectKeys(dec *json.Decoder) ([]string, error) {
	if err := expectDelim(dec, '{'); err != nil {
		return nil, err
	}
	var keys []string
	for dec.More() {
		k, err := dec.Token()
		if err != nil {
			return nil, err
		}
		s, ok := k.(string)
		if !ok {
			return nil, errors.New("object key is not a string")
		}
		keys = append(keys, s)
		if err := skip(dec); err != nil {
			return nil, err
		}
	}
	_, err := dec.Token() // }
	return keys, err
}

// skip consumes one JSON value of any size.
func skip(dec *json.Decoder) error {
	depth := 0
	for {
		t, err := dec.Token()
		if err != nil {
			return err
		}
		if d, ok := t.(json.Delim); ok {
			if d == '{' || d == '[' {
				depth++
			} else {
				depth--
			}
		}
		if depth == 0 {
			return nil
		}
	}
}

func expectDelim(dec *json.Decoder, want json.Delim) error {
	t, err := dec.Token()
	if err != nil {
		return err
	}
	if d, ok := t.(json.Delim); !ok || d != want {
		return fmt.Errorf("expected %q, got %v", want, t)
	}
	return nil
}
