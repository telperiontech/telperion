// Package httpcheck reads the running version of anything that exposes it
// over HTTP: a JSON field (/version.json), a response header, or a regex on
// the body. A 2xx answer with a version means that version runs on the target.
package httpcheck

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/telperiontech/telperion/apps/beacon/internal/adapter"
	"github.com/telperiontech/telperion/apps/beacon/internal/catalog"
	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/platform"
)

// maxBody bounds what is read for a JSON pointer or a regex.
const maxBody = 1 << 20

// Runtime implements adapter.Runtime.
type Runtime struct {
	Client *platform.Client
}

var _ adapter.Runtime = Runtime{}

// Running returns the version the URL reports, as the only deployed version
// on the target.
func (rt Runtime) Running(ctx context.Context, pkg string, d catalog.Deploy) (model.Obs, error) {
	if d.HTTPCheck == nil {
		return model.Obs{}, errors.New("not an http-check target")
	}
	var version string
	err := rt.Client.Do(ctx, platform.Request{URL: d.HTTPCheck.URL}, func(resp *http.Response) error {
		var err error
		version, err = Extract(d.HTTPCheck.Version, resp.Header, io.LimitReader(resp.Body, maxBody))
		return err
	})
	if err != nil {
		return model.Obs{}, err
	}
	return model.Obs{
		Package: pkg, Version: version, Stage: model.Deployed, Target: d.Target, State: model.OK,
		URL: d.HTTPCheck.URL, Exclusive: true,
	}, nil
}

// Extract reads the version from a response; a leading "v" is dropped.
func Extract(src catalog.VersionSource, h http.Header, body io.Reader) (string, error) {
	var v string
	switch {
	case src.Header != "":
		v = h.Get(src.Header)
	case src.JSON != "":
		var doc any
		if err := json.NewDecoder(body).Decode(&doc); err != nil {
			return "", fmt.Errorf("body is not JSON: %w", err)
		}
		val, err := pointer(doc, src.JSON)
		if err != nil {
			return "", err
		}
		v = fmt.Sprint(val)
	case src.Regex != "":
		re, err := regexp.Compile(src.Regex)
		if err != nil {
			return "", err
		}
		b, err := io.ReadAll(body)
		if err != nil {
			return "", err
		}
		m := re.FindSubmatch(b)
		if len(m) < 2 {
			return "", errors.New("the regex did not match the body")
		}
		v = string(m[1])
	}
	v = strings.TrimPrefix(strings.TrimSpace(v), "v")
	if v == "" {
		return "", errors.New("no version in the response")
	}
	return v, nil
}

// pointer resolves a JSON pointer (RFC 6901).
func pointer(doc any, ptr string) (any, error) {
	cur := doc
	for _, raw := range strings.Split(strings.TrimPrefix(ptr, "/"), "/") {
		tok := strings.ReplaceAll(strings.ReplaceAll(raw, "~1", "/"), "~0", "~")
		switch node := cur.(type) {
		case map[string]any:
			next, ok := node[tok]
			if !ok {
				return nil, fmt.Errorf("%s: no key %q", ptr, tok)
			}
			cur = next
		case []any:
			i, err := strconv.Atoi(tok)
			if err != nil || i < 0 || i >= len(node) {
				return nil, fmt.Errorf("%s: no index %q", ptr, tok)
			}
			cur = node[i]
		default:
			return nil, fmt.Errorf("%s: %q is not inside an object or array", ptr, tok)
		}
	}
	return cur, nil
}
