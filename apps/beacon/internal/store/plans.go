package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

// ErrNoRun: no plan run with that id.
var ErrNoRun = errors.New("no such plan run")

// CreateRun stores a new run and its steps and returns its id.
func (s *Store) CreateRun(ctx context.Context, r model.Run) (int64, error) {
	var id int64
	err := s.WithTx(ctx, func(tx *Store) error {
		res, err := tx.q.ExecContext(ctx,
			"INSERT INTO plan_runs (title, state, source, actor, created) VALUES (?, ?, ?, ?, ?)",
			r.Title, model.RunRunning, r.Source, r.Actor, tx.unix())
		if err != nil {
			return err
		}
		if id, err = res.LastInsertId(); err != nil {
			return err
		}
		for pos, st := range r.Steps {
			data, err := json.Marshal(st)
			if err != nil {
				return err
			}
			if _, err := tx.q.ExecContext(ctx, "INSERT INTO plan_steps (run, key, pos, package, state, data) VALUES (?, ?, ?, ?, ?, ?)",
				id, st.Key, pos, st.Package, st.State, data); err != nil {
				return err
			}
		}
		return nil
	})
	return id, err
}

// SaveStep writes a step's state and data.
func (s *Store) SaveStep(ctx context.Context, run int64, st model.Step) error {
	data, err := json.Marshal(st)
	if err != nil {
		return err
	}
	_, err = s.q.ExecContext(ctx, "UPDATE plan_steps SET state = ?, data = ? WHERE run = ? AND key = ?", st.State, data, run, st.Key)
	return err
}

// FinishRun sets a run's final state.
func (s *Store) FinishRun(ctx context.Context, run int64, state model.RunState) error {
	_, err := s.q.ExecContext(ctx, "UPDATE plan_runs SET state = ?, finished = ? WHERE id = ?", state, s.unix(), run)
	return err
}

// Run returns one run with its steps.
func (s *Store) Run(ctx context.Context, id int64) (model.Run, error) {
	runs, err := s.runs(ctx, "WHERE id = ?", id)
	if err != nil {
		return model.Run{}, err
	}
	if len(runs) == 0 {
		return model.Run{}, ErrNoRun
	}
	return runs[0], nil
}

// ActiveRuns returns the runs still running, oldest first.
func (s *Store) ActiveRuns(ctx context.Context) ([]model.Run, error) {
	return s.runs(ctx, "WHERE state = ? ORDER BY id", model.RunRunning)
}

// ListRuns returns up to limit runs older than beforeID (0: newest), newest
// first.
func (s *Store) ListRuns(ctx context.Context, beforeID int64, limit int) ([]model.Run, error) {
	if beforeID <= 0 {
		return s.runs(ctx, "ORDER BY id DESC LIMIT ?", limit)
	}
	return s.runs(ctx, "WHERE id < ? ORDER BY id DESC LIMIT ?", beforeID, limit)
}

// PackageRuns returns the newest limit runs with a step on pkg.
func (s *Store) PackageRuns(ctx context.Context, pkg string, limit int) ([]model.Run, error) {
	return s.runs(ctx, "WHERE id IN (SELECT run FROM plan_steps WHERE package = ?) ORDER BY id DESC LIMIT ?", pkg, limit)
}

func (s *Store) runs(ctx context.Context, where string, args ...any) ([]model.Run, error) {
	rows, err := s.q.QueryContext(ctx,
		"SELECT id, title, state, source, actor, created, finished FROM plan_runs "+where, args...)
	if err != nil {
		return nil, err
	}
	var out []model.Run
	for rows.Next() {
		var r model.Run
		var created, finished int64
		if err := rows.Scan(&r.ID, &r.Title, &r.State, &r.Source, &r.Actor, &created, &finished); err != nil {
			rows.Close()
			return nil, err
		}
		r.Created = time.Unix(created, 0)
		if finished > 0 {
			r.Finished = time.Unix(finished, 0)
		}
		out = append(out, r)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range out {
		if out[i].Steps, err = s.steps(ctx, out[i].ID); err != nil {
			return nil, err
		}
	}
	if out == nil {
		out = []model.Run{}
	}
	return out, nil
}

func (s *Store) steps(ctx context.Context, run int64) ([]model.Step, error) {
	rows, err := s.q.QueryContext(ctx, "SELECT data FROM plan_steps WHERE run = ? ORDER BY pos", run)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.Step{}
	for rows.Next() {
		var data []byte
		var st model.Step
		if err := rows.Scan(&data); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(data, &st); err != nil {
			return nil, err
		}
		out = append(out, st)
	}
	return out, rows.Err()
}

// Lock takes the named lease for a step, or reports who holds it. Taking a
// lease the step already holds succeeds.
func (s *Store) Lock(ctx context.Context, name string, run int64, step string) (ok bool, holder int64, err error) {
	err = s.WithTx(ctx, func(tx *Store) error {
		if _, err := tx.q.ExecContext(ctx, "INSERT OR IGNORE INTO locks (name, run, step, since) VALUES (?, ?, ?, ?)",
			name, run, step, tx.unix()); err != nil {
			return err
		}
		var hs string
		if err := tx.q.QueryRowContext(ctx, "SELECT run, step FROM locks WHERE name = ?", name).Scan(&holder, &hs); err != nil {
			return err
		}
		ok = holder == run && hs == step
		return nil
	})
	return ok, holder, err
}

// Unlock releases a named lease held by the step.
func (s *Store) Unlock(ctx context.Context, name string, run int64, step string) error {
	_, err := s.q.ExecContext(ctx, "DELETE FROM locks WHERE name = ? AND run = ? AND step = ?", name, run, step)
	return err
}

// ReleaseLocks releases every lease the step holds.
func (s *Store) ReleaseLocks(ctx context.Context, run int64, step string) error {
	_, err := s.q.ExecContext(ctx, "DELETE FROM locks WHERE run = ? AND step = ?", run, step)
	return err
}

// ReleaseStaleLocks drops leases whose step has finished (e.g. a crash between
// finishing a step and releasing its locks).
func (s *Store) ReleaseStaleLocks(ctx context.Context) error {
	_, err := s.q.ExecContext(ctx, `DELETE FROM locks WHERE NOT EXISTS (
		SELECT 1 FROM plan_steps p WHERE p.run = locks.run AND p.key = locks.step
		AND p.state NOT IN ('done', 'failed', 'skipped', 'cancelled'))`)
	return err
}
