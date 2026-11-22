// Package pattern implements host patterns used by grants.
//
// A pattern is a host name whose labels are either literal, the placeholder
// {client} (one label, replaced by the requesting client's name) or, as the
// leftmost label only, "*" (one or more labels of any depth). Examples:
//
//	*.{client}.dev.example.com   app.alice.dev..., api.pc.alice.dev...
//	{client}.dev.example.com     alice.dev... only
//	status.example.com           exactly that name
package pattern

import (
	"fmt"
	"strings"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/names"
)

// Placeholder is replaced by the client name.
const Placeholder = "{client}"

// Pattern is a parsed host pattern. The zero value matches nothing.
type Pattern struct {
	labels []string
}

// Parse validates and normalises a pattern.
func Parse(s string) (Pattern, error) {
	s = strings.TrimSuffix(strings.ToLower(strings.TrimSpace(s)), ".")
	if s == "" {
		return Pattern{}, fmt.Errorf("empty pattern")
	}
	labels := strings.Split(s, ".")
	if len(labels) < 2 {
		return Pattern{}, fmt.Errorf("pattern %q needs at least two labels", s)
	}
	for i, l := range labels {
		switch {
		case l == "*" && i == 0:
		case l == "*":
			return Pattern{}, fmt.Errorf("pattern %q: '*' is only allowed as the leftmost label", s)
		case l == Placeholder:
		case strings.ContainsAny(l, "{}*"):
			return Pattern{}, fmt.Errorf("pattern %q: label %q must be literal, '*' or %s", s, l, Placeholder)
		case !names.ValidLabel(l):
			return Pattern{}, fmt.Errorf("pattern %q has an invalid label %q", s, l)
		}
	}
	return Pattern{labels: labels}, nil
}

// MustParse is Parse for constants and tests.
func MustParse(s string) Pattern {
	p, err := Parse(s)
	if err != nil {
		panic(err)
	}
	return p
}

func (p Pattern) String() string { return strings.Join(p.labels, ".") }

// Wildcard reports whether the pattern starts with "*".
func (p Pattern) Wildcard() bool { return len(p.labels) > 0 && p.labels[0] == "*" }

// HasPlaceholder reports whether the pattern contains {client}.
func (p Pattern) HasPlaceholder() bool {
	for _, l := range p.labels {
		if l == Placeholder {
			return true
		}
	}
	return false
}

// Expand replaces {client} with a client name.
func (p Pattern) Expand(client string) string {
	return strings.ReplaceAll(p.String(), Placeholder, client)
}

// Within reports whether every name the pattern can match lies inside zone
// (equal to it or below it). The labels covering the zone must be literal.
func (p Pattern) Within(zone string) bool {
	z := names.Labels(zone)
	if len(p.labels) < len(z) {
		return false
	}
	tail := p.labels[len(p.labels)-len(z):]
	for i := range z {
		if tail[i] != z[i] {
			return false
		}
	}
	return true
}
