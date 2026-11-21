// Package names validates and normalises the names frp-gate deals with:
// client/group/instance names (single DNS labels) and host names.
package names

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
)

var labelRe = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`)

// ValidLabel reports whether s is a lowercase DNS label.
func ValidLabel(s string) bool { return labelRe.MatchString(s) }

// Label normalises and validates an entity name. Names are DNS labels so a
// client name can be substituted for {client} in a host pattern.
func Label(kind, s string) (string, error) {
	s = strings.ToLower(strings.TrimSpace(s))
	if !ValidLabel(s) {
		return "", fmt.Errorf("%s name %q must be a DNS label: a-z, 0-9 and '-', 1-63 characters, not starting or ending with '-'", kind, s)
	}
	return s, nil
}

// Domain normalises a host name: lowercase, no trailing dot, valid labels.
// With allowWildcard, the leftmost label may be "*" (as in frp customDomains).
func Domain(s string, allowWildcard bool) (string, error) {
	s = strings.TrimSuffix(strings.ToLower(strings.TrimSpace(s)), ".")
	if s == "" {
		return "", errors.New("empty host name")
	}
	if len(s) > 253 {
		return "", fmt.Errorf("host name %q is too long", s)
	}
	labels := strings.Split(s, ".")
	if len(labels) < 2 {
		return "", fmt.Errorf("host name %q needs at least two labels", s)
	}
	for i, l := range labels {
		if l == "*" && i == 0 && allowWildcard {
			continue
		}
		if !ValidLabel(l) {
			return "", fmt.Errorf("host name %q has an invalid label %q", s, l)
		}
	}
	return s, nil
}

// Labels splits a normalised host name.
func Labels(host string) []string { return strings.Split(host, ".") }

// WildcardParents returns the frp wildcard names that would route host, most
// specific first: a.b.c.d → *.b.c.d, *.c.d. frps tries the same list.
func WildcardParents(host string) []string {
	l := Labels(host)
	var out []string
	for i := 1; len(l)-i >= 2; i++ {
		out = append(out, "*."+strings.Join(l[i:], "."))
	}
	return out
}
