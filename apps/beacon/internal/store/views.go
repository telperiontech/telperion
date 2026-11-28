package store

import (
	"context"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

// PackageState is everything observed about one package: its versions with
// their first-seen times and its stage rows.
type PackageState struct {
	Versions map[string]time.Time
	Rows     []model.Row
}

// States reads the observations of one package, or of all packages (pkg "").
func (s *Store) States(ctx context.Context, pkg string) (map[string]*PackageState, error) {
	where, args := "", []any{}
	if pkg != "" {
		where, args = " WHERE package = ?", []any{pkg}
	}
	out := map[string]*PackageState{}
	get := func(name string) *PackageState {
		if out[name] == nil {
			out[name] = &PackageState{Versions: map[string]time.Time{}}
		}
		return out[name]
	}

	rows, err := s.q.QueryContext(ctx, "SELECT package, version, first_seen FROM versions"+where, args...)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var name, v string
		var first int64
		if err := rows.Scan(&name, &v, &first); err != nil {
			rows.Close()
			return nil, err
		}
		get(name).Versions[v] = time.Unix(first, 0)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	rows, err = s.q.QueryContext(ctx,
		"SELECT package, version, stage, target, state, since, url, detail FROM stage_states"+where, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		var r model.Row
		var since int64
		if err := rows.Scan(&name, &r.Version, &r.Stage, &r.Target, &r.State, &since, &r.URL, &r.Detail); err != nil {
			return nil, err
		}
		r.Since = time.Unix(since, 0)
		ps := get(name)
		ps.Rows = append(ps.Rows, r)
	}
	return out, rows.Err()
}

// Pending lists the packages that have a stage in progress or an active plan
// step, so the poller watches them closely (also after a restart).
func (s *Store) Pending(ctx context.Context) (map[string]bool, error) {
	rows, err := s.q.QueryContext(ctx, `SELECT package FROM stage_states WHERE state = ?
		UNION SELECT package FROM plan_steps WHERE state NOT IN ('done', 'failed', 'skipped', 'cancelled')`, model.Pending)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]bool{}
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		out[p] = true
	}
	return out, rows.Err()
}
