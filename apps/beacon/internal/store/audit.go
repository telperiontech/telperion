package store

import (
	"context"
	"time"

	"github.com/telperiontech/telperion/libs/go-kit/audit"
)

// AuditEntry is one action by a person or the config file. It never holds a
// secret.
type AuditEntry struct {
	ID     int64     `json:"id"`
	At     time.Time `json:"at"`
	Source string    `json:"source"` // ui | api | apply | start
	Actor  string    `json:"actor"`  // remote address, or the config file path
	Action string    `json:"action"` // e.g. config.apply, session.login
	Object string    `json:"object"` // e.g. package js-utils
	Detail string    `json:"detail"`
}

// Audit records an action by the actor in ctx.
func (s *Store) Audit(ctx context.Context, action, object, detail string) error {
	a := audit.From(ctx)
	_, err := s.q.ExecContext(ctx,
		"INSERT INTO audit_log (at, source, actor, action, object, detail) VALUES (?, ?, ?, ?, ?, ?)",
		s.unix(), a.Source, a.Who, action, object, detail)
	return err
}

// ListAudit returns up to limit entries older than beforeID (0: newest),
// newest first.
func (s *Store) ListAudit(ctx context.Context, beforeID int64, limit int) ([]AuditEntry, error) {
	q := "SELECT id, at, source, actor, action, object, detail FROM audit_log"
	args := []any{}
	if beforeID > 0 {
		q += " WHERE id < ?"
		args = append(args, beforeID)
	}
	q += " ORDER BY id DESC LIMIT ?"
	args = append(args, limit)
	rows, err := s.q.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AuditEntry{}
	for rows.Next() {
		var e AuditEntry
		var at int64
		if err := rows.Scan(&e.ID, &at, &e.Source, &e.Actor, &e.Action, &e.Object, &e.Detail); err != nil {
			return nil, err
		}
		e.At = time.Unix(at, 0)
		out = append(out, e)
	}
	return out, rows.Err()
}

// PruneAudit keeps the newest keep entries.
func (s *Store) PruneAudit(ctx context.Context, keep int) (int64, error) {
	res, err := s.q.ExecContext(ctx,
		"DELETE FROM audit_log WHERE id <= (SELECT id FROM audit_log ORDER BY id DESC LIMIT 1 OFFSET ?)", keep)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
