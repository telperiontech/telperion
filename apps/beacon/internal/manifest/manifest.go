// Package manifest edits dependency ranges in a package.json. It changes only
// the range strings, so the file keeps its formatting, key order and the
// rest of its content byte for byte.
package manifest

import (
	"encoding/json"
	"fmt"
	"regexp"
)

// Sections are the parts of a package.json that hold dependency ranges, in
// the order a range is reported from.
var Sections = []string{"dependencies", "peerDependencies", "devDependencies", "optionalDependencies"}

// Range is one dependency's current range in a manifest.
type Range struct {
	Name  string
	Range string // "" when the manifest does not depend on Name
	// Plain: a version range Beacon may rewrite (^1.2.3, ~1.2, >=1.0.0,
	// 1.2.3); workspace:, file:, git and other forms are left alone.
	Plain bool
}

// Ranges reads the current range of each name.
func Ranges(content []byte, names ...string) ([]Range, error) {
	var m map[string]json.RawMessage
	if err := json.Unmarshal(content, &m); err != nil {
		return nil, fmt.Errorf("not a package.json: %w", err)
	}
	sections := map[string]map[string]string{}
	for _, s := range Sections {
		if raw, ok := m[s]; ok {
			deps := map[string]string{}
			if err := json.Unmarshal(raw, &deps); err != nil {
				return nil, fmt.Errorf("%s: %w", s, err)
			}
			sections[s] = deps
		}
	}
	out := make([]Range, 0, len(names))
	for _, n := range names {
		r := Range{Name: n}
		for _, s := range Sections {
			if v, ok := sections[s][n]; ok {
				r.Range, r.Plain = v, plain.MatchString(v)
				break
			}
		}
		out = append(out, r)
	}
	return out, nil
}

var plain = regexp.MustCompile(`^(\^|~|>=)?\s*\d+(\.(\d+|x|\*))*([-+][0-9A-Za-z.-]+)?$`)

// Set writes range want[name] wherever the manifest depends on name with a
// plain range (in every section, e.g. both peer and dev dependencies). Names
// it does not depend on, and other range forms, are left as they are.
func Set(content []byte, want map[string]string) []byte {
	out := content
	for name, to := range want {
		re := regexp.MustCompile(`("` + regexp.QuoteMeta(jsonString(name)) + `"\s*:\s*")([^"\\]*)(")`)
		out = re.ReplaceAllFunc(out, func(m []byte) []byte {
			sub := re.FindSubmatch(m)
			if !plain.Match(sub[2]) {
				return m
			}
			return append(append(append([]byte{}, sub[1]...), jsonString(to)...), sub[3]...)
		})
	}
	return out
}

// jsonString is s as it appears between quotes in JSON.
func jsonString(s string) string {
	b, _ := json.Marshal(s)
	return string(b[1 : len(b)-1])
}
