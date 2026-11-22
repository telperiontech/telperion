package pattern

import "github.com/telperiontech/telperion/libs/frp-gate/internal/names"

// Capture checks whether host is covered by the pattern and returns the value
// {client} binds to ("" when the pattern has no placeholder).
//
// host must be normalised (see names.Domain). It may be an frp wildcard
// request such as "*.api.alice.dev.example.com"; such a request stands for
// every name of one or more labels below its suffix, and is covered only if
// the pattern covers all of them.
func (p Pattern) Capture(host string) (client string, ok bool) {
	if len(p.labels) == 0 || host == "" {
		return "", false
	}
	h := names.Labels(host)
	if h[0] == "*" {
		// The pattern must also be "*" + suffix, and the request's fixed
		// part must end with that suffix (any extra labels are fine because
		// the pattern's "*" absorbs them).
		if !p.Wildcard() {
			return "", false
		}
		rest, suffix := h[1:], p.labels[1:]
		if len(rest) < len(suffix) {
			return "", false
		}
		return matchLabels(rest[len(rest)-len(suffix):], suffix)
	}
	if p.Wildcard() {
		suffix := p.labels[1:]
		if len(h) < len(suffix)+1 {
			return "", false
		}
		return matchLabels(h[len(h)-len(suffix):], suffix)
	}
	if len(h) != len(p.labels) {
		return "", false
	}
	return matchLabels(h, p.labels)
}

// Covers reports whether host is covered for the given client.
func (p Pattern) Covers(host, client string) bool {
	c, ok := p.Capture(host)
	return ok && (c == "" || c == client)
}

func matchLabels(host, pat []string) (client string, ok bool) {
	for i, l := range pat {
		switch {
		case l == Placeholder:
			if !names.ValidLabel(host[i]) {
				return "", false
			}
			if client != "" && client != host[i] {
				return "", false
			}
			client = host[i]
		case l != host[i]:
			return "", false
		}
	}
	return client, true
}
