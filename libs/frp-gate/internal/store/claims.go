package store

import (
	"context"
	"strings"
	"time"
)

// TouchClaims records that a client is using these host names now.
func (s *Store) TouchClaims(ctx context.Context, clientID int64, hosts []string) error {
	now := s.unix()
	for _, h := range hosts {
		if _, err := s.db.ExecContext(ctx,
			"INSERT INTO claims (name, client_id, last_claimed) VALUES (?, ?, ?)"+
				" ON CONFLICT (name, client_id) DO UPDATE SET last_claimed = excluded.last_claimed",
			h, clientID, now); err != nil {
			return mapErr(err)
		}
	}
	return nil
}

// ClaimantsOf returns the ids of clients that claimed any of the given names
// at or after since.
func (s *Store) ClaimantsOf(ctx context.Context, hosts []string, since time.Time) ([]int64, error) {
	if len(hosts) == 0 {
		return nil, nil
	}
	args := make([]any, 0, len(hosts)+1)
	for _, h := range hosts {
		args = append(args, h)
	}
	args = append(args, since.Unix())
	q := "SELECT DISTINCT client_id FROM claims WHERE name IN (?" + strings.Repeat(", ?", len(hosts)-1) +
		") AND last_claimed >= ?"
	rows, err := s.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// PruneClaims deletes claims older than before.
func (s *Store) PruneClaims(ctx context.Context, before time.Time) error {
	_, err := s.db.ExecContext(ctx, "DELETE FROM claims WHERE last_claimed < ?", before.Unix())
	return err
}
