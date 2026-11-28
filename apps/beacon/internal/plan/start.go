package plan

import (
	"context"
	"fmt"

	"github.com/telperiontech/telperion/apps/beacon/internal/model"
	"github.com/telperiontech/telperion/apps/beacon/internal/observe"
	"github.com/telperiontech/telperion/apps/beacon/internal/store"
	"github.com/telperiontech/telperion/libs/go-kit/audit"
)

// Confirm is what the user agreed to on the preview.
type Confirm struct {
	Fingerprint string `json:"fingerprint"`
	Major       bool   `json:"major"` // the separate tick for a major version change
}

// Start computes the preview again and, if it is what the user confirmed,
// stores the run; the runner takes it from there. On ErrInvalid, ErrMoved and
// ErrConfirm the returned preview is the current one.
func (e Env) Start(ctx context.Context, req Request, c Confirm, kick func()) (int64, Preview, error) {
	p, err := e.Preview(ctx, req)
	switch {
	case err != nil:
		return 0, Preview{}, err
	case len(p.Errors) > 0:
		return 0, p, ErrInvalid
	case p.Fingerprint != c.Fingerprint:
		return 0, p, ErrMoved
	case p.Major && !c.Major:
		return 0, p, ErrConfirm
	}
	a := audit.From(ctx)
	run := model.Run{Title: p.Title, Source: a.Source, Actor: a.Who}
	pkgs := make([]string, 0, len(p.Steps))
	for _, s := range p.Steps {
		st := s.Step
		if st.Type == model.StepRelease {
			st.Commit = "" // read again when the step fires, under the repo lock
		}
		run.Steps = append(run.Steps, st)
		pkgs = append(pkgs, st.Package)
	}
	var id int64
	err = e.Store.WithTx(ctx, func(tx *store.Store) error {
		var err error
		if id, err = tx.CreateRun(ctx, run); err != nil {
			return err
		}
		return tx.Audit(ctx, "plan.start", fmt.Sprintf("run %d", id), p.Title)
	})
	if err != nil {
		return 0, p, err
	}
	e.wake(pkgs...)
	e.publish(observe.Notice{Packages: pkgs, Runs: []int64{id}})
	if kick != nil {
		kick()
	}
	return id, p, nil
}
