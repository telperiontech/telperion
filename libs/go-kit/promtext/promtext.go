// Package promtext writes metrics in the Prometheus text exposition format,
// without a client library. Callers keep label values bounded.
package promtext

import (
	"fmt"
	"io"
	"strconv"
	"strings"
)

// ContentType is the media type of the text format.
const ContentType = "text/plain; version=0.0.4; charset=utf-8"

// Header writes the HELP and TYPE lines of a metric family.
func Header(w io.Writer, name, kind, help string) {
	fmt.Fprintf(w, "# HELP %s %s\n# TYPE %s %s\n", name, help, name, kind)
}

// Sample writes one sample. labels alternate name, value.
func Sample(w io.Writer, name string, value float64, labels ...string) {
	fmt.Fprintf(w, "%s%s %s\n", name, Labels(labels...), strconv.FormatFloat(value, 'g', -1, 64))
}

// Labels renders {a="x",b="y"}, or "" without labels. labels alternate name, value.
func Labels(labels ...string) string {
	if len(labels) < 2 {
		return ""
	}
	parts := make([]string, 0, len(labels)/2)
	for i := 0; i+1 < len(labels); i += 2 {
		parts = append(parts, labels[i]+"="+Quote(labels[i+1]))
	}
	return "{" + strings.Join(parts, ",") + "}"
}

var escaper = strings.NewReplacer(`\`, `\\`, `"`, `\"`, "\n", `\n`)

// Quote returns a label value in quotes, escaped.
func Quote(s string) string { return `"` + escaper.Replace(s) + `"` }
