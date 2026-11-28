package store

import (
	"context"
	"time"

	"github.com/telperiontech/telperion/apps/beacon/internal/model"
)

// Event is one logged transition.
type Event struct {
	ID      int64       `json:"id"`
	At      time.Time   `json:"at"`
	Package string      `json:"package"`
	Version string      `json:"version"`
	Stage   model.Stage `json:"stage"`
	Target  string      `json:"target,omitempty"`
	State   model.State `json:"state"`
	URL     string      `json:"url,omitempty"`
	Detail  string      `json:"detail,omitempty"`
}

// Events returns up to limit events older than beforeID (0: newest), newest
// first, of one package or (pkg "") all packages.
func (s *Store) Events(ctx context.Context, pkg string, beforeID int64, limit int) ([]Event, error) {
	q := "SELECT id, at, package, version, stage, target, state, url, detail FROM events WHERE 1 = 1"
	var args []any
	if pkg != "" {
		q += " AND package = ?"
		args = append(args, pkg)
	}
	if beforeID > 0 {
		q += " AND id < ?"
		args = append(args, beforeID)
	}
	q += " ORDER BY id DESC LIMIT ?"
	args = append(args, limit)
	rows, err := s.q.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Event{}
	for rows.Next() {
		var e Event
		var at int64
		if err := rows.Scan(&e.ID, &at, &e.Package, &e.Version, &e.Stage, &e.Target, &e.State, &e.URL, &e.Detail); err != nil {
			return nil, err
		}
		e.At = time.Unix(at, 0)
		out = append(out, e)
	}
	return out, rows.Err()
}

// PruneEvents keeps the newest keep events and none older than maxAge.
func (s *Store) PruneEvents(ctx context.Context, keep int, maxAge time.Duration) (int64, error) {
	res, err := s.q.ExecContext(ctx, `DELETE FROM events WHERE at < ?
		OR id <= (SELECT id FROM events ORDER BY id DESC LIMIT 1 OFFSET ?)`,
		s.now().Add(-maxAge).Unix(), keep)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
