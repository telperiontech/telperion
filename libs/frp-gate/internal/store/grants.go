package store

import (
	"context"
	"database/sql"
	"time"
)

// Grant kinds.
const (
	KindHost = "host"
	KindPort = "port"
)

// Grant is something a client (or every member of a group) may claim:
// host names matching Pattern in a zone, or a port range on an frps.
// Exactly one of ClientID and GroupID is non-zero.
type Grant struct {
	ID         int64     `json:"id"`
	ClientID   int64     `json:"client_id,omitempty"`
	GroupID    int64     `json:"group_id,omitempty"`
	Kind       string    `json:"kind"`
	ZoneID     int64     `json:"zone_id,omitempty"`
	Pattern    string    `json:"pattern,omitempty"`
	InstanceID int64     `json:"instance_id,omitempty"`
	Proto      string    `json:"proto,omitempty"`
	PortFrom   int       `json:"port_from,omitempty"`
	PortTo     int       `json:"port_to,omitempty"`
	Managed    bool      `json:"managed"`
	CreatedAt  time.Time `json:"created_at"`
}

const grantCols = "id, client_id, group_id, kind, zone_id, pattern, instance_id, proto, port_from, port_to, created_at, managed"

func scanGrant(row scanner) (Grant, error) {
	var g Grant
	var client, group, zone, inst sql.NullInt64
	var created int64
	err := row.Scan(&g.ID, &client, &group, &g.Kind, &zone, &g.Pattern, &inst, &g.Proto, &g.PortFrom, &g.PortTo, &created, &g.Managed)
	g.ClientID, g.GroupID, g.ZoneID, g.InstanceID = client.Int64, group.Int64, zone.Int64, inst.Int64
	g.CreatedAt = time.Unix(created, 0)
	return g, err
}

func nullID(id int64) sql.NullInt64 { return sql.NullInt64{Int64: id, Valid: id != 0} }

// CreateGrant stores a validated grant.
func (s *Store) CreateGrant(ctx context.Context, g Grant) (Grant, error) {
	now := s.unix()
	res, err := s.q.ExecContext(ctx,
		"INSERT INTO grants (client_id, group_id, kind, zone_id, pattern, instance_id, proto, port_from, port_to, created_at)"+
			" VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		nullID(g.ClientID), nullID(g.GroupID), g.Kind, nullID(g.ZoneID), g.Pattern,
		nullID(g.InstanceID), g.Proto, g.PortFrom, g.PortTo, now)
	if err != nil {
		return Grant{}, mapErr(err)
	}
	g.ID, _ = res.LastInsertId()
	g.CreatedAt = time.Unix(now, 0)
	return g, nil
}

// ListGrants returns every grant.
func (s *Store) ListGrants(ctx context.Context) ([]Grant, error) {
	return s.queryGrants(ctx, "SELECT "+grantCols+" FROM grants ORDER BY kind, id")
}

// HostGrants returns every host grant (used by the TLS ask).
func (s *Store) HostGrants(ctx context.Context) ([]Grant, error) {
	return s.queryGrants(ctx, "SELECT "+grantCols+" FROM grants WHERE kind = 'host' ORDER BY id")
}

// EffectiveGrants returns the grants a client has directly or through groups.
func (s *Store) EffectiveGrants(ctx context.Context, clientID int64) ([]Grant, error) {
	return s.queryGrants(ctx, "SELECT "+grantCols+" FROM grants WHERE client_id = ?"+
		" OR group_id IN (SELECT group_id FROM group_members WHERE client_id = ?) ORDER BY id", clientID, clientID)
}

func (s *Store) queryGrants(ctx context.Context, q string, args ...any) ([]Grant, error) {
	rows, err := s.q.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Grant
	for rows.Next() {
		g, err := scanGrant(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

// DeleteGrant removes a grant.
func (s *Store) DeleteGrant(ctx context.Context, id int64) error {
	return affected(s.q.ExecContext(ctx, "DELETE FROM grants WHERE id = ?", id))
}

// GrantByID returns one grant.
func (s *Store) GrantByID(ctx context.Context, id int64) (Grant, error) {
	g, err := scanGrant(s.q.QueryRowContext(ctx, "SELECT "+grantCols+" FROM grants WHERE id = ?", id))
	return g, mapErr(err)
}
