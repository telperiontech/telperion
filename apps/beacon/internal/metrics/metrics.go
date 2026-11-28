// Package metrics serves Beacon's /metrics in the Prometheus text format
// (go-kit promtext): polls by layer and result, and the current gaps by stage.
// Label values are bounded: layers and results are fixed sets, stages are the
// four chain stages.
package metrics

import (
	"cmp"
	"context"
	"net/http"
	"slices"
	"sync"

	"github.com/telperiontech/telperion/libs/go-kit/promtext"
)

// Gauges is the current state, read at scrape time.
type Gauges struct {
	Packages int
	Gaps     map[string]int // by "to" stage
	Stuck    map[string]int // by "to" stage
}

// Metrics holds the counters. A nil *Metrics ignores Poll.
type Metrics struct {
	version string
	mu      sync.Mutex
	polls   map[[2]string]uint64 // layer, result
}

// New returns empty counters.
func New(version string) *Metrics {
	return &Metrics{version: version, polls: map[[2]string]uint64{}}
}

// Poll counts one poll.
func (m *Metrics) Poll(layer, result string) {
	if m == nil {
		return
	}
	m.mu.Lock()
	m.polls[[2]string{layer, result}]++
	m.mu.Unlock()
}

// Handler serves GET /metrics; gauges reads the current state.
func (m *Metrics) Handler(gauges func(context.Context) (Gauges, error)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		g, err := gauges(r.Context())
		if err != nil {
			http.Error(w, "state unavailable", http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", promtext.ContentType)
		promtext.Header(w, "beacon_build_info", "gauge", "Beacon version.")
		promtext.Sample(w, "beacon_build_info", 1, "version", m.version)
		promtext.Header(w, "beacon_packages", "gauge", "Configured packages.")
		promtext.Sample(w, "beacon_packages", float64(g.Packages))
		promtext.Header(w, "beacon_gaps", "gauge", "Versions stuck between two stages, by the stage they wait for.")
		promtext.Header(w, "beacon_gaps_stuck", "gauge", "Gaps older than their stage's threshold, or failed.")
		for _, st := range []string{"built", "published", "deployed"} {
			promtext.Sample(w, "beacon_gaps", float64(g.Gaps[st]), "stage", st)
			promtext.Sample(w, "beacon_gaps_stuck", float64(g.Stuck[st]), "stage", st)
		}
		promtext.Header(w, "beacon_polls_total", "counter", "Adapter polls by layer and result (ok, not_modified, error).")
		m.mu.Lock()
		keys := make([][2]string, 0, len(m.polls))
		for k := range m.polls {
			keys = append(keys, k)
		}
		slices.SortFunc(keys, func(a, b [2]string) int { return cmp.Or(cmp.Compare(a[0], b[0]), cmp.Compare(a[1], b[1])) })
		for _, k := range keys {
			promtext.Sample(w, "beacon_polls_total", float64(m.polls[k]), "layer", k[0], "result", k[1])
		}
		m.mu.Unlock()
	})
}
