package main

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/admin"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/audit"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/config"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// ensureInstance returns the step that applies FRP_GATE_INSTANCE_KEY (nil if
// it is unset). Start and `frp-gate apply` both run it before the config
// file, so they start from the same state.
func ensureInstance(ctx context.Context, getenv func(string) string, log *slog.Logger) (func(tx *store.Store) error, error) {
	key, err := config.InstanceKey(getenv)
	if err != nil || key == "" {
		return nil, err
	}
	name := config.InstanceName(getenv)
	addr := strings.TrimSpace(getenv("FRP_GATE_INSTANCE_SERVER_ADDR"))
	actx := audit.WithActor(ctx, audit.Actor{Source: audit.SourceStart, Who: "FRP_GATE_INSTANCE_KEY"})
	return func(tx *store.Store) error {
		svc := &admin.Service{Store: tx, Log: log}
		if err := svc.EnsureInstance(actx, name, key, addr); err != nil {
			return fmt.Errorf("FRP_GATE_INSTANCE_*: %w", err)
		}
		return nil
	}, nil
}
