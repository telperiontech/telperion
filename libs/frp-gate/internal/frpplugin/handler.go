// Package frpplugin serves the frps HTTP server-plugin protocol
// (frps [[httpPlugins]]; see frp's doc/server_plugin.md).
package frpplugin

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	plugin "github.com/fatedier/frp/pkg/plugin/server"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/metrics"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/policy"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/token"
)

// Ops is the list to put in the frps [[httpPlugins]] block.
var Ops = []string{plugin.OpLogin, plugin.OpNewProxy, plugin.OpCloseProxy, plugin.OpPing, plugin.OpNewWorkConn}

const maxBody = 1 << 20

// Handler answers plugin calls on POST /frps/{key}. The key in the path
// identifies (and authenticates) the frps instance.
type Handler struct {
	Store   *store.Store
	Policy  *policy.Policy
	Log     *slog.Logger
	Metrics *metrics.Metrics // optional
}

type request struct {
	Version string          `json:"version"`
	Op      string          `json:"op"`
	Content json.RawMessage `json:"content"`
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	inst, err := h.Store.InstanceByKeyHash(ctx, token.Hash(r.PathValue("key")))
	if errors.Is(err, store.ErrNotFound) {
		h.Log.Warn("plugin call with unknown instance key", "remote", r.RemoteAddr)
		h.Metrics.PluginOp("other", false, "unknown_instance")
		http.Error(w, "unknown instance", http.StatusNotFound)
		return
	}
	if err != nil {
		h.Log.Error("instance lookup failed", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	var req request
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBody)).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	user, d, err := h.decide(ctx, inst, req)
	if err != nil {
		http.Error(w, "invalid "+req.Op+" content", http.StatusBadRequest)
		return
	}
	h.Metrics.PluginOp(req.Op, d.Allow, d.Code)
	if d.Allow {
		h.Log.Debug("allow", "instance", inst.Name, "op", req.Op, "user", user)
	} else {
		h.Log.Info("reject", "instance", inst.Name, "op", req.Op, "user", user, "reason", d.Reason)
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(plugin.Response{Reject: !d.Allow, RejectReason: d.Reason, Unchange: true})
}

// decide decodes the op's content with frp's own types and asks the policy.
func (h *Handler) decide(ctx context.Context, inst store.Instance, req request) (string, policy.Decision, error) {
	p := h.Policy
	switch req.Op {
	case plugin.OpLogin:
		var c plugin.LoginContent
		if err := json.Unmarshal(req.Content, &c); err != nil {
			return "", policy.Decision{}, err
		}
		return c.User, p.Login(ctx, inst, &c), nil
	case plugin.OpNewProxy:
		var c plugin.NewProxyContent
		if err := json.Unmarshal(req.Content, &c); err != nil {
			return "", policy.Decision{}, err
		}
		return c.User.User, p.NewProxy(ctx, inst, &c), nil
	case plugin.OpCloseProxy:
		var c plugin.CloseProxyContent
		if err := json.Unmarshal(req.Content, &c); err != nil {
			return "", policy.Decision{}, err
		}
		return c.User.User, p.CloseProxy(ctx, inst, &c), nil
	case plugin.OpPing:
		var c plugin.PingContent
		if err := json.Unmarshal(req.Content, &c); err != nil {
			return "", policy.Decision{}, err
		}
		return c.User.User, p.Ping(ctx, inst, &c), nil
	case plugin.OpNewWorkConn:
		var c plugin.NewWorkConnContent
		if err := json.Unmarshal(req.Content, &c); err != nil {
			return "", policy.Decision{}, err
		}
		return c.User.User, p.NewWorkConn(ctx, inst, &c), nil
	default:
		// Ops frp-gate has no opinion on (e.g. NewUserConn) pass unchanged.
		return "", policy.Decision{Allow: true}, nil
	}
}
