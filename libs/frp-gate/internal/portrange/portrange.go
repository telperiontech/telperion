// Package portrange parses and formats the port ranges of port grants.
package portrange

import (
	"fmt"
	"strconv"
	"strings"
)

// Parse accepts a port ("25565") or a range ("6000-6010") within 1-65535.
func Parse(s string) (from, to int, err error) {
	s = strings.TrimSpace(s)
	a, b, found := strings.Cut(s, "-")
	from, err1 := strconv.Atoi(strings.TrimSpace(a))
	to = from
	var err2 error
	if found {
		to, err2 = strconv.Atoi(strings.TrimSpace(b))
	}
	if err1 != nil || err2 != nil || from < 1 || to > 65535 || from > to {
		return 0, 0, fmt.Errorf("ports must be a port (25565) or a range (6000-6010) within 1-65535, got %q", s)
	}
	return from, to, nil
}

// Format is the inverse of Parse.
func Format(from, to int) string {
	if from == to {
		return strconv.Itoa(from)
	}
	return fmt.Sprintf("%d-%d", from, to)
}
