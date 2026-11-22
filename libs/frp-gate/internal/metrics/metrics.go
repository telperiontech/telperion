// Package metrics counts frp-gate's decisions and serves them in the
// Prometheus text format, without a client library.
//
// Label values are bounded: op is one of frps' plugin ops, result is
// allow/reject, reason is a fixed code from policy.Decision.Code, and client
// is a client name.
package metrics

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"
	"sync"
)

// Metrics holds the counters. A nil *Metrics ignores every call.
type Metrics struct {
	version string

	mu     sync.Mutex
	plugin map[[3]string]uint64 // op, result, reason
	ask    map[[2]string]uint64 // result, reason
}

// New returns empty counters.
func New(version string) *Metrics {
	return &Metrics{version: version, plugin: map[[3]string]uint64{}, ask: map[[2]string]uint64{}}
}

func result(allow bool) string {
	if allow {
		return "allow"
	}
	return "reject"
}

// knownOps keeps the op label bounded whatever frps sends.
var knownOps = map[string]bool{
	"Login": true, "NewProxy": true, "CloseProxy": true, "Ping": true, "NewWorkConn": true, "NewUserConn": true,
}

// PluginOp counts one frps plugin decision.
func (m *Metrics) PluginOp(op string, allow bool, reason string) {
	if m == nil {
		return
	}
	if !knownOps[op] {
		op = "other"
	}
	m.mu.Lock()
	m.plugin[[3]string{op, result(allow), reason}]++
	m.mu.Unlock()
}

// Ask counts one Caddy TLS ask decision.
func (m *Metrics) Ask(allow bool, reason string) {
	if m == nil {
		return
	}
	m.mu.Lock()
	m.ask[[2]string{result(allow), reason}]++
	m.mu.Unlock()
}

// SessionCounts returns the number of connected sessions per client name,
// with every client present (0 when not connected), so that an alert on
// "home-pi == 0" works.
type SessionCounts func(ctx context.Context) (map[string]int, error)

// Handler serves GET /metrics.
func (m *Metrics) Handler(sessions SessionCounts) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		counts, err := sessions(r.Context())
		if err != nil {
			http.Error(w, "database unavailable", http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		m.Write(w, counts)
	})
}

// Write prints all metrics in the Prometheus text format.
func (m *Metrics) Write(w io.Writer, sessions map[string]int) {
	header(w, "frp_gate_build_info", "gauge", "frp-gate version.")
	fmt.Fprintf(w, "frp_gate_build_info{version=%s} 1\n", quote(m.version))

	header(w, "frp_gate_sessions_connected", "gauge",
		"Connected frpc sessions per client (a heartbeat within FRP_GATE_SESSION_TIMEOUT).")
	for _, c := range sortedKeys(sessions) {
		fmt.Fprintf(w, "frp_gate_sessions_connected{client=%s} %d\n", quote(c), sessions[c])
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	header(w, "frp_gate_plugin_ops_total", "counter", "frps plugin operations by op, result and reason code.")
	pk := make([][3]string, 0, len(m.plugin))
	for k := range m.plugin {
		pk = append(pk, k)
	}
	slices.SortFunc(pk, func(a, b [3]string) int {
		return strings.Compare(strings.Join(a[:], "\x00"), strings.Join(b[:], "\x00"))
	})
	for _, k := range pk {
		fmt.Fprintf(w, "frp_gate_plugin_ops_total{op=%s,result=%s,reason=%s} %d\n", quote(k[0]), quote(k[1]), quote(k[2]), m.plugin[k])
	}

	header(w, "frp_gate_tls_ask_total", "counter", "Caddy on-demand TLS asks by result and reason code.")
	ak := make([][2]string, 0, len(m.ask))
	for k := range m.ask {
		ak = append(ak, k)
	}
	slices.SortFunc(ak, func(a, b [2]string) int { return strings.Compare(a[0]+"\x00"+a[1], b[0]+"\x00"+b[1]) })
	for _, k := range ak {
		fmt.Fprintf(w, "frp_gate_tls_ask_total{result=%s,reason=%s} %d\n", quote(k[0]), quote(k[1]), m.ask[k])
	}
}

func header(w io.Writer, name, kind, help string) {
	fmt.Fprintf(w, "# HELP %s %s\n# TYPE %s %s\n", name, help, name, kind)
}

var escaper = strings.NewReplacer(`\`, `\\`, `"`, `\"`, "\n", `\n`)

func quote(s string) string { return `"` + escaper.Replace(s) + `"` }

func sortedKeys(m map[string]int) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	slices.Sort(keys)
	return keys
}
