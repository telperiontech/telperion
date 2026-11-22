package declare

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/audit"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// Change ops, in the order a diff prints their symbols.
const (
	OpCreate = "create" // +
	OpAdopt  = "adopt"  // = an object made in the UI becomes managed
	OpUpdate = "update" // ~
	OpDelete = "delete" // -
)

var opSymbol = map[string]string{OpCreate: "+", OpAdopt: "=", OpUpdate: "~", OpDelete: "-"}

// Change is one difference between the file and the database. It never
// holds a secret: a token change reads "token changed".
type Change struct {
	Op     string `json:"op"`
	Kind   string `json:"kind"` // zone | instance | group | client | grant
	Name   string `json:"name"`
	Detail string `json:"detail,omitempty"`
}

func (c Change) String() string {
	s := opSymbol[c.Op] + " " + c.Kind + " " + c.Name
	if c.Detail != "" {
		s += ": " + c.Detail
	}
	return s
}

// Result lists what Apply changed (or would change, in a dry run).
type Result struct {
	Changes []Change
}

var errDryRun = errors.New("dry run")

// Apply makes the managed part of the database match d in one transaction:
// either every change is made or none. With dryRun the transaction is
// rolled back and Result says what would have changed. Each change is also
// written to the audit log, with the actor from ctx (audit.WithActor).
func Apply(ctx context.Context, st *store.Store, d *Desired, dryRun bool) (Result, error) {
	return ApplyAfter(ctx, st, d, dryRun, nil)
}

// ApplyAfter is Apply with a step run first in the same transaction (and
// rolled back with it in a dry run): FRP_GATE_INSTANCE_KEY, so that apply
// sees the same starting point as frp-gate's start.
func ApplyAfter(ctx context.Context, st *store.Store, d *Desired, dryRun bool, before func(tx *store.Store) error) (Result, error) {
	var res Result
	err := st.WithTx(ctx, func(tx *store.Store) error {
		if before != nil {
			if err := before(tx); err != nil {
				return err
			}
		}
		a := &applier{ctx: ctx, st: tx, d: d, res: &res}
		if err := a.run(); err != nil {
			return err
		}
		if dryRun {
			return errDryRun
		}
		return nil
	})
	if errors.Is(err, errDryRun) {
		err = nil
	}
	if err != nil {
		return Result{}, err
	}
	return res, nil
}

// applier holds the state of one Apply: name → id maps filled as objects
// are found or created.
type applier struct {
	ctx context.Context
	st  *store.Store
	d   *Desired
	res *Result

	zoneID, instanceID, groupID, clientID map[string]int64
}

func (a *applier) run() error {
	a.zoneID, a.instanceID = map[string]int64{}, map[string]int64{}
	a.groupID, a.clientID = map[string]int64{}, map[string]int64{}
	steps := []func() error{
		a.zones, a.instances, a.groups, a.clients, a.members,
		a.grants, a.deleteClients, a.deleteGroups, a.deleteInstances, a.deleteZones,
	}
	for _, step := range steps {
		if err := step(); err != nil {
			return err
		}
	}
	return nil
}

// change records a change in the result and the audit log.
func (a *applier) change(op, kind, name string, details ...string) error {
	c := Change{Op: op, Kind: kind, Name: name, Detail: strings.Join(nonEmpty(details), "; ")}
	a.res.Changes = append(a.res.Changes, c)
	actor := audit.From(a.ctx)
	return a.st.AddAudit(a.ctx, store.AuditEntry{
		Source: actor.Source, Actor: actor.Who, Action: kind + "." + op, Object: name, Detail: c.Detail,
	})
}

func nonEmpty(in []string) []string {
	out := in[:0:0]
	for _, s := range in {
		if s != "" {
			out = append(out, s)
		}
	}
	return out
}

// adopt marks an object made in the UI as managed.
func (a *applier) adopt(table, kind, name string, id int64, managed bool) error {
	if managed {
		return nil
	}
	if err := a.st.SetManaged(a.ctx, table, id, true); err != nil {
		return err
	}
	return a.change(OpAdopt, kind, name, "already existed, now managed by the file")
}

// conflict explains a unique-constraint failure on a secret.
func conflict(err error, format string, args ...any) error {
	if errors.Is(err, store.ErrConflict) {
		return fmt.Errorf(format, args...)
	}
	return err
}
