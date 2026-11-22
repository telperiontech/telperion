package pattern

import (
	"fmt"
	"strings"
)

// InZone turns a pattern written relative to a zone ("*.{client}", "@" or ""
// for the zone itself) or in full into the validated full pattern, which
// must lie inside the zone.
func InZone(raw, zone string) (string, error) {
	raw = strings.TrimSuffix(strings.ToLower(strings.TrimSpace(raw)), ".")
	switch {
	case raw == "" || raw == "@":
		raw = zone
	case raw != zone && !strings.HasSuffix(raw, "."+zone):
		raw += "." + zone
	}
	p, err := Parse(raw)
	if err != nil {
		return "", err
	}
	if !p.Within(zone) {
		return "", fmt.Errorf("pattern %s is not inside zone %s", p, zone)
	}
	return p.String(), nil
}

// Relative is the inverse of InZone: the shortest form of a full pattern
// relative to its zone ("@" for the zone itself).
func Relative(full, zone string) string {
	if full == zone {
		return "@"
	}
	return strings.TrimSuffix(full, "."+zone)
}
