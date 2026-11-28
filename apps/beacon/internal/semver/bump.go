package semver

import (
	"fmt"
	"strconv"
)

// Bump is a release kind: which part of the version goes up.
type Bump string

// Bumps.
const (
	Major Bump = "major"
	Minor Bump = "minor"
	Patch Bump = "patch"
)

// Valid reports whether b is major, minor or patch.
func (b Bump) Valid() bool { return b == Major || b == Minor || b == Patch }

// Next is the version a bump of latest gives. A release after a prerelease of
// the same core is that core (1.2.0-rc.1 + minor → 1.2.0 when 1.2.0 is a
// minor step). With no latest version ("") the base is 0.0.0.
func Next(latest string, b Bump) (string, error) {
	if !b.Valid() {
		return "", fmt.Errorf("unknown bump %q (major, minor or patch)", b)
	}
	v := Version{}
	if latest != "" {
		var ok bool
		if v, ok = Parse(latest); !ok {
			return "", fmt.Errorf("%q is not a semantic version", latest)
		}
	}
	pre := len(v.Pre) > 0
	switch {
	case b == Major && !(pre && v.Minor == 0 && v.Patch == 0):
		v.Major, v.Minor, v.Patch = v.Major+1, 0, 0
	case b == Minor && !(pre && v.Patch == 0):
		v.Minor, v.Patch = v.Minor+1, 0
	case b == Patch && !pre:
		v.Patch++
	}
	return format(v.Major, v.Minor, v.Patch), nil
}

// Kind says which part changed from a to b (both valid, b newer): major,
// minor or patch; "" if b is not newer.
func Kind(a, b string) Bump {
	va, okA := Parse(a)
	vb, okB := Parse(b)
	switch {
	case !okB:
		return ""
	case !okA:
		return Major
	case Compare(vb, va) <= 0:
		return ""
	case vb.Major != va.Major:
		return Major
	case vb.Minor != va.Minor:
		return Minor
	}
	return Patch
}

// Latest is the newest release (no prerelease) among versions; "" if none.
func Latest(versions []string) string {
	var best Version
	found := ""
	for _, s := range versions {
		v, ok := Parse(s)
		if !ok || len(v.Pre) > 0 {
			continue
		}
		if found == "" || Compare(v, best) > 0 {
			best, found = v, s
		}
	}
	return found
}

func format(major, minor, patch uint64) string {
	return strconv.FormatUint(major, 10) + "." + strconv.FormatUint(minor, 10) + "." + strconv.FormatUint(patch, 10)
}
