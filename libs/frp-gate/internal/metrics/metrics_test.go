package metrics

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWrite(t *testing.T) {
	m := New("1.1.0")
	m.PluginOp("Login", true, "")
	m.PluginOp("Login", true, "")
	m.PluginOp("Ping", false, "disabled")
	m.PluginOp("SomethingNew", true, "")
	m.Ask(false, "not_claimed")
	m.Ask(true, "")

	var b strings.Builder
	m.Write(&b, map[string]int{"home-pi": 1, "sahin": 0, `we"ird`: 2})
	out := b.String()
	for _, want := range []string{
		`frp_gate_build_info{version="1.1.0"} 1`,
		`frp_gate_sessions_connected{client="home-pi"} 1`,
		`frp_gate_sessions_connected{client="sahin"} 0`,
		`frp_gate_sessions_connected{client="we\"ird"} 2`,
		`frp_gate_plugin_ops_total{op="Login",result="allow",reason=""} 2`,
		`frp_gate_plugin_ops_total{op="Ping",result="reject",reason="disabled"} 1`,
		`frp_gate_plugin_ops_total{op="other",result="allow",reason=""} 1`,
		`frp_gate_tls_ask_total{result="reject",reason="not_claimed"} 1`,
		`frp_gate_tls_ask_total{result="allow",reason=""} 1`,
		"# TYPE frp_gate_plugin_ops_total counter",
	} {
		if !strings.Contains(out, want+"\n") {
			t.Errorf("missing %q in:\n%s", want, out)
		}
	}
}

func TestNilIsSafe(t *testing.T) {
	var m *Metrics
	m.PluginOp("Login", true, "")
	m.Ask(true, "")
}

func TestHandler(t *testing.T) {
	m := New("dev")
	h := m.Handler(func(context.Context) (map[string]int, error) { return map[string]int{"a": 1}, nil })
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/metrics", nil))
	if rec.Code != 200 || !strings.HasPrefix(rec.Header().Get("Content-Type"), "text/plain") ||
		!strings.Contains(rec.Body.String(), `frp_gate_sessions_connected{client="a"} 1`) {
		t.Fatalf("%d %q", rec.Code, rec.Body.String())
	}
}
