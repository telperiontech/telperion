package store

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

// Change is a state transition caused by an observation.
type Change struct {
	Package string      `json:"package"`
	Version string      `json:"version"`
	Stage   model.Stage `json:"stage"`
	Target  string      `json:"target,omitempty"`
	From    model.State `json:"from"`
	To      model.State `json:"to"`
	At      time.Time   `json:"at"`
}

// Observe records observations in one transaction and returns the state
// transitions they caused. Repeating an observation changes nothing; a new
// URL or detail updates the row without an event.
func (s *Store) Observe(ctx context.Context, obs []model.Obs) ([]Change, error) {
	var changes []Change
	err := s.WithTx(ctx, func(tx *Store) error {
		for _, o := range obs {
			cs, err := tx.observe(ctx, o)
			if err != nil {
				return err
			}
			changes = append(changes, cs...)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return changes, nil
}

func (s *Store) observe(ctx context.Context, o model.Obs) ([]Change, error) {
	at := o.At
	if at.IsZero() || at.After(s.now()) {
		at = s.now()
	}
	if _, err := s.q.ExecContext(ctx,
		"INSERT OR IGNORE INTO versions (package, version, first_seen) VALUES (?, ?, ?)",
		o.Package, o.Version, at.Unix()); err != nil {
		return nil, err
	}
	c, err := s.setState(ctx, o.Package, o.Version, o.Stage, o.Target, o.State, at, o.URL, o.Detail)
	if err != nil || c == nil && !o.Exclusive {
		return asList(c), err
	}
	changes := asList(c)
	if o.Exclusive {
		others, err := s.demote(ctx, o, at)
		if err != nil {
			return nil, err
		}
		changes = append(changes, others...)
	}
	return changes, nil
}

func asList(c *Change) []Change {
	if c == nil {
		return nil
	}
	return []Change{*c}
}

// setState writes one stage state and logs a transition; nil when the state
// did not change.
func (s *Store) setState(ctx context.Context, pkg, version string, stage model.Stage, target string,
	state model.State, at time.Time, url, detail string) (*Change, error) {
	var cur model.State
	var curURL, curDetail string
	err := s.q.QueryRowContext(ctx,
		"SELECT state, url, detail FROM stage_states WHERE package = ? AND version = ? AND stage = ? AND target = ?",
		pkg, version, stage, target).Scan(&cur, &curURL, &curDetail)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		cur = model.Missing
		if state == model.Missing {
			return nil, nil
		}
	case err != nil:
		return nil, err
	case cur == state:
		if curURL != url || curDetail != detail {
			_, err = s.q.ExecContext(ctx,
				"UPDATE stage_states SET url = ?, detail = ? WHERE package = ? AND version = ? AND stage = ? AND target = ?",
				url, detail, pkg, version, stage, target)
		}
		return nil, err
	}
	if _, err := s.q.ExecContext(ctx, `INSERT INTO stage_states (package, version, stage, target, state, since, url, detail)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (package, version, stage, target) DO UPDATE SET
			state = excluded.state, since = excluded.since, url = excluded.url, detail = excluded.detail`,
		pkg, version, stage, target, state, at.Unix(), url, detail); err != nil {
		return nil, err
	}
	if _, err := s.q.ExecContext(ctx,
		"INSERT INTO events (at, package, version, stage, target, state, url, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		at.Unix(), pkg, version, stage, target, state, url, detail); err != nil {
		return nil, err
	}
	return &Change{Package: pkg, Version: version, Stage: stage, Target: target, From: cur, To: state, At: at}, nil
}

// demote sets the other versions in o's state at o's target to missing: a
// target runs one version at a time.
func (s *Store) demote(ctx context.Context, o model.Obs, at time.Time) ([]Change, error) {
	rows, err := s.q.QueryContext(ctx,
		"SELECT version FROM stage_states WHERE package = ? AND stage = ? AND target = ? AND state = ? AND version <> ?",
		o.Package, o.Stage, o.Target, o.State, o.Version)
	if err != nil {
		return nil, err
	}
	var versions []string
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			rows.Close()
			return nil, err
		}
		versions = append(versions, v)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	var changes []Change
	for _, v := range versions {
		c, err := s.setState(ctx, o.Package, v, o.Stage, o.Target, model.Missing, at, "", "replaced by "+o.Version)
		if err != nil {
			return nil, err
		}
		changes = append(changes, asList(c)...)
	}
	return changes, nil
}
