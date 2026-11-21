package frpplugin

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	plugin "github.com/fatedier/frp/pkg/plugin/server"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/policy"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/token"
)

// TestWireFormat posts the same JSON frps sends and checks the response shape.
func TestWireFormat(t *testing.T) {
	ctx := t.Context()
	st, err := store.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	key := token.New(token.InstancePrefix)
	inst, _ := st.CreateInstance(ctx, "main", token.Hash(key), "")
	zone, _ := st.CreateZone(ctx, "dev.example.com")
	_ = st.SetInstanceZones(ctx, inst.ID, []int64{zone.ID})
	tok := token.New(token.ClientPrefix)
	c, _ := st.CreateClient(ctx, "sahin", token.Hash(tok), "")
	_, _ = st.CreateGrant(ctx, store.Grant{ClientID: c.ID, Kind: store.KindHost, ZoneID: zone.ID, Pattern: "*.{client}.dev.example.com"})

	mux := http.NewServeMux()
	mux.Handle("POST /frps/{key}", &Handler{Store: st, Policy: policy.New(st, "", time.Hour, log), Log: log})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	call := func(path, op, content string) (int, plugin.Response) {
		body := `{"version":"0.1.0","op":"` + op + `","content":` + content + `}`
		resp, err := http.Post(srv.URL+path+"?version=0.1.0&op="+op, "application/json", strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		var out plugin.Response
		_ = json.NewDecoder(resp.Body).Decode(&out)
		return resp.StatusCode, out
	}
	user := `{"user":"sahin","metas":{"token":"` + tok + `"},"run_id":"r1"}`

	code, res := call("/frps/"+key, plugin.OpLogin, `{"version":"0.65.0","user":"sahin","metas":{"token":"`+tok+`"},"client_address":"1.2.3.4:1"}`)
	if code != 200 || res.Reject || !res.Unchange {
		t.Fatalf("login: %d %+v", code, res)
	}
	code, res = call("/frps/"+key, plugin.OpNewProxy, `{"user":`+user+`,"proxy_name":"sahin.web","proxy_type":"http","custom_domains":["a.sahin.dev.example.com"]}`)
	if code != 200 || res.Reject {
		t.Fatalf("own proxy: %d %+v", code, res)
	}
	_, res = call("/frps/"+key, plugin.OpNewProxy, `{"user":`+user+`,"proxy_name":"sahin.x","proxy_type":"http","custom_domains":["a.ertan.dev.example.com"]}`)
	if !res.Reject || !strings.Contains(res.RejectReason, "not granted") {
		t.Fatalf("foreign proxy: %+v", res)
	}
	_, res = call("/frps/"+key, plugin.OpNewUserConn, `{"user":`+user+`,"proxy_name":"sahin.web"}`)
	if res.Reject {
		t.Fatalf("unhandled op rejected: %+v", res)
	}
	if code, _ = call("/frps/wrong", plugin.OpLogin, `{}`); code != http.StatusNotFound {
		t.Fatalf("unknown key: %d", code)
	}
	if code, _ = call("/frps/"+key, plugin.OpPing, `"not an object"`); code != http.StatusBadRequest {
		t.Fatalf("bad content: %d", code)
	}
}
