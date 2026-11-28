// Package semver parses and orders semantic versions (semver.org 2.0.0).
// Bumping (major/minor/patch) comes with the release actions in Phase 2.
package semver

import (
	"cmp"
	"regexp"
	"strconv"
	"strings"
)

// Version is a parsed semantic version. Build metadata is kept in Raw only; it
// does not take part in ordering.
type Version struct {
	Major, Minor, Patch uint64
	Pre                 []string // prerelease identifiers, e.g. ["rc", "1"]
	Raw                 string   // the string that was parsed
}

// Pattern matches a semantic version without anchors, for use inside larger
// patterns such as tag names.
const Pattern = `(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)` +
	`(?:-(?:[0-9A-Za-z-]+)(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?`

var full = regexp.MustCompile(`^` + Pattern + `$`)

// Parse parses s (no leading "v").
func Parse(s string) (Version, bool) {
	if !full.MatchString(s) {
		return Version{}, false
	}
	core, _, _ := strings.Cut(s, "+")
	core, pre, hasPre := strings.Cut(core, "-")
	parts := strings.Split(core, ".")
	v := Version{Raw: s}
	var err error
	if v.Major, err = strconv.ParseUint(parts[0], 10, 64); err != nil {
		return Version{}, false
	}
	if v.Minor, err = strconv.ParseUint(parts[1], 10, 64); err != nil {
		return Version{}, false
	}
	if v.Patch, err = strconv.ParseUint(parts[2], 10, 64); err != nil {
		return Version{}, false
	}
	if hasPre {
		v.Pre = strings.Split(pre, ".")
		for _, id := range v.Pre {
			if len(id) > 1 && id[0] == '0' && isNumeric(id) {
				return Version{}, false // numeric identifiers have no leading zeros
			}
		}
	}
	return v, true
}

// Compare orders a and b: -1, 0 or +1. A prerelease sorts before its release.
func Compare(a, b Version) int {
	if c := cmp.Compare(a.Major, b.Major); c != 0 {
		return c
	}
	if c := cmp.Compare(a.Minor, b.Minor); c != 0 {
		return c
	}
	if c := cmp.Compare(a.Patch, b.Patch); c != 0 {
		return c
	}
	switch {
	case len(a.Pre) == 0 && len(b.Pre) == 0:
		return 0
	case len(a.Pre) == 0:
		return 1
	case len(b.Pre) == 0:
		return -1
	}
	for i := 0; i < len(a.Pre) && i < len(b.Pre); i++ {
		if c := compareIdent(a.Pre[i], b.Pre[i]); c != 0 {
			return c
		}
	}
	return cmp.Compare(len(a.Pre), len(b.Pre))
}

// CompareStrings orders two version strings; unparsable ones sort first, by text.
func CompareStrings(a, b string) int {
	va, okA := Parse(a)
	vb, okB := Parse(b)
	switch {
	case okA && okB:
		return Compare(va, vb)
	case okA:
		return 1
	case okB:
		return -1
	}
	return strings.Compare(a, b)
}

func compareIdent(a, b string) int {
	na, nb := isNumeric(a), isNumeric(b)
	switch {
	case na && nb:
		if c := cmp.Compare(len(a), len(b)); c != 0 {
			return c
		}
		return strings.Compare(a, b)
	case na:
		return -1 // numeric identifiers sort before alphanumeric ones
	case nb:
		return 1
	}
	return strings.Compare(a, b)
}

func isNumeric(s string) bool {
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return s != ""
}
