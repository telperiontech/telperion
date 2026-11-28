package catalog

import (
	"regexp"
	"strings"

	"github.com/telperiontech/telperion/apps/beacon/internal/semver"
)

// DefaultTag is the tag pattern of this repo: js-utils-v4.1.0.
const DefaultTag = "{package}-v{version}"

// TagMatcher maps tag names to versions of one package.
type TagMatcher struct {
	pattern string
	pkg     string
	re      *regexp.Regexp
}

// NewTagMatcher compiles pattern ({package} and {version} placeholders) for pkg.
func NewTagMatcher(pattern, pkg string) (TagMatcher, error) {
	expr := regexp.QuoteMeta(pattern)
	expr = strings.ReplaceAll(expr, regexp.QuoteMeta("{package}"), regexp.QuoteMeta(pkg))
	expr = strings.ReplaceAll(expr, regexp.QuoteMeta("{version}"), "("+semver.Pattern+")")
	re, err := regexp.Compile("^" + expr + "$")
	if err != nil {
		return TagMatcher{}, err
	}
	return TagMatcher{pattern: pattern, pkg: pkg, re: re}, nil
}

// Version returns the version a tag names, if the tag is this package's.
func (m TagMatcher) Version(tag string) (string, bool) {
	sub := m.re.FindStringSubmatch(tag)
	if sub == nil {
		return "", false
	}
	return sub[1], true
}

// Tag is the tag name of a version.
func (m TagMatcher) Tag(version string) string {
	return strings.ReplaceAll(strings.ReplaceAll(m.pattern, "{package}", m.pkg), "{version}", version)
}
