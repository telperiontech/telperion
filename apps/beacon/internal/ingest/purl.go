package ingest

import (
	"errors"
	"net/url"
	"strings"
)

// PURL is a package URL (github.com/package-url/purl-spec), the artifact id
// CDEvents carry: pkg:type/namespace/name@version?qualifiers#subpath.
type PURL struct {
	Type       string
	Namespace  string // e.g. @telperion (npm scope); "" if none
	Name       string
	Version    string
	Qualifiers url.Values
}

// ParsePURL parses a package URL; components are percent-decoded.
func ParsePURL(s string) (PURL, error) {
	rest, ok := strings.CutPrefix(s, "pkg:")
	if !ok {
		return PURL{}, errors.New("not a purl (pkg:...)")
	}
	rest, _, _ = strings.Cut(rest, "#")
	rest, query, _ := strings.Cut(rest, "?")
	var p PURL
	var err error
	if p.Qualifiers, err = url.ParseQuery(query); err != nil {
		return PURL{}, err
	}
	if i := strings.LastIndex(rest, "@"); i > 0 && !strings.Contains(rest[i:], "/") {
		if p.Version, err = url.PathUnescape(rest[i+1:]); err != nil {
			return PURL{}, err
		}
		rest = rest[:i]
	}
	parts := strings.Split(strings.Trim(rest, "/"), "/")
	if len(parts) < 2 {
		return PURL{}, errors.New("a purl needs a type and a name")
	}
	for i, part := range parts {
		if parts[i], err = url.PathUnescape(part); err != nil {
			return PURL{}, err
		}
	}
	p.Type = strings.ToLower(parts[0])
	p.Name = parts[len(parts)-1]
	p.Namespace = strings.Join(parts[1:len(parts)-1], "/")
	return p, nil
}

// FullName is namespace/name (e.g. @telperion/js-utils).
func (p PURL) FullName() string {
	if p.Namespace == "" {
		return p.Name
	}
	return p.Namespace + "/" + p.Name
}
