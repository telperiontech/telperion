package store

import (
	"context"
	"time"
)

// Zone is a base domain pointed at the gateway.
type Zone struct {
	ID        int64     `json:"id"`
	Domain    string    `json:"domain"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateZone adds a zone. domain must be normalised.
func (s *Store) CreateZone(ctx context.Context, domain string) (Zone, error) {
	now := s.unix()
	res, err := s.db.ExecContext(ctx, "INSERT INTO zones (domain, created_at) VALUES (?, ?)", domain, now)
	if err != nil {
		return Zone{}, mapErr(err)
	}
	id, _ := res.LastInsertId()
	return Zone{ID: id, Domain: domain, CreatedAt: time.Unix(now, 0)}, nil
}

// ZoneByID returns one zone.
func (s *Store) ZoneByID(ctx context.Context, id int64) (Zone, error) {
	var z Zone
	var created int64
	err := s.db.QueryRowContext(ctx, "SELECT id, domain, created_at FROM zones WHERE id = ?", id).
		Scan(&z.ID, &z.Domain, &created)
	z.CreatedAt = time.Unix(created, 0)
	return z, mapErr(err)
}

// ListZones returns all zones ordered by domain.
func (s *Store) ListZones(ctx context.Context) ([]Zone, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT id, domain, created_at FROM zones ORDER BY domain")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Zone
	for rows.Next() {
		var z Zone
		var created int64
		if err := rows.Scan(&z.ID, &z.Domain, &created); err != nil {
			return nil, err
		}
		z.CreatedAt = time.Unix(created, 0)
		out = append(out, z)
	}
	return out, rows.Err()
}

// DeleteZone removes a zone. It fails with ErrInUse while grants refer to it.
func (s *Store) DeleteZone(ctx context.Context, id int64) error {
	return affected(s.db.ExecContext(ctx, "DELETE FROM zones WHERE id = ?", id))
}

// ZoneByDomain returns the zone with this domain.
func (s *Store) ZoneByDomain(ctx context.Context, domain string) (Zone, error) {
	var z Zone
	var created int64
	err := s.db.QueryRowContext(ctx, "SELECT id, domain, created_at FROM zones WHERE domain = ?", domain).
		Scan(&z.ID, &z.Domain, &created)
	z.CreatedAt = time.Unix(created, 0)
	return z, mapErr(err)
}
