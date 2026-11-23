package store

import (
	"context"
	"strings"
	"time"
)

// Session is a logged-in frpc on one frps.
type Session struct {
	InstanceID int64     `json:"instance_id"`
	RunID      string    `json:"run_id"`
	ClientID   int64     `json:"client_id"`
	FirstSeen  time.Time `json:"first_seen"`
	LastSeen   time.Time `json:"last_seen"`
	Proxies    []Proxy   `json:"proxies"`
}

// Proxy is a proxy frps accepted for a session.
type Proxy struct {
	Name       string    `json:"name"`
	Type       string    `json:"type"`
	Domains    []string  `json:"domains,omitempty"`
	RemotePort int       `json:"remote_port,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

// TouchSession records that a session is alive.
func (s *Store) TouchSession(ctx context.Context, instanceID int64, runID string, clientID int64) error {
	now := s.unix()
	_, err := s.q.ExecContext(ctx,
		"INSERT INTO sessions (instance_id, run_id, client_id, first_seen, last_seen) VALUES (?, ?, ?, ?, ?)"+
			" ON CONFLICT (instance_id, run_id) DO UPDATE SET client_id = excluded.client_id, last_seen = excluded.last_seen",
		instanceID, runID, clientID, now, now)
	return mapErr(err)
}

// AddProxy records an accepted proxy (replacing one with the same name).
func (s *Store) AddProxy(ctx context.Context, instanceID int64, runID string, p Proxy) error {
	_, err := s.q.ExecContext(ctx,
		"INSERT OR REPLACE INTO proxies (instance_id, run_id, name, type, domains, remote_port, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		instanceID, runID, p.Name, p.Type, strings.Join(p.Domains, ","), p.RemotePort, s.unix())
	return mapErr(err)
}

// ProxyHolder returns the session (without its proxies) that holds a proxy
// name on an frps, or ErrNotFound.
func (s *Store) ProxyHolder(ctx context.Context, instanceID int64, name string) (Session, error) {
	var x Session
	var first, last int64
	err := s.q.QueryRowContext(ctx,
		"SELECT s.instance_id, s.run_id, s.client_id, s.first_seen, s.last_seen FROM proxies p"+
			" JOIN sessions s ON s.instance_id = p.instance_id AND s.run_id = p.run_id"+
			" WHERE p.instance_id = ? AND p.name = ?",
		instanceID, name).Scan(&x.InstanceID, &x.RunID, &x.ClientID, &first, &last)
	if err != nil {
		return Session{}, mapErr(err)
	}
	x.FirstSeen, x.LastSeen = time.Unix(first, 0), time.Unix(last, 0)
	return x, nil
}

// RemoveProxy forgets a closed proxy.
func (s *Store) RemoveProxy(ctx context.Context, instanceID int64, name string) error {
	_, err := s.q.ExecContext(ctx, "DELETE FROM proxies WHERE instance_id = ? AND name = ?", instanceID, name)
	return err
}

// SessionProxies returns the proxies of one session.
func (s *Store) SessionProxies(ctx context.Context, instanceID int64, runID string) ([]Proxy, error) {
	rows, err := s.q.QueryContext(ctx,
		"SELECT name, type, domains, remote_port, created_at FROM proxies WHERE instance_id = ? AND run_id = ? ORDER BY name",
		instanceID, runID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Proxy{}
	for rows.Next() {
		var p Proxy
		var domains string
		var created int64
		if err := rows.Scan(&p.Name, &p.Type, &domains, &p.RemotePort, &created); err != nil {
			return nil, err
		}
		if domains != "" {
			p.Domains = strings.Split(domains, ",")
		}
		p.CreatedAt = time.Unix(created, 0)
		out = append(out, p)
	}
	return out, rows.Err()
}

// Sessions returns the sessions seen since the given time, with proxies,
// newest first. Pass the zero time for all.
func (s *Store) Sessions(ctx context.Context, since time.Time) ([]Session, error) {
	rows, err := s.q.QueryContext(ctx,
		"SELECT instance_id, run_id, client_id, first_seen, last_seen FROM sessions WHERE last_seen >= ? ORDER BY last_seen DESC",
		since.Unix())
	if err != nil {
		return nil, err
	}
	var out []Session
	for rows.Next() {
		var x Session
		var first, last int64
		if err := rows.Scan(&x.InstanceID, &x.RunID, &x.ClientID, &first, &last); err != nil {
			rows.Close()
			return nil, err
		}
		x.FirstSeen, x.LastSeen = time.Unix(first, 0), time.Unix(last, 0)
		out = append(out, x)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range out {
		if out[i].Proxies, err = s.SessionProxies(ctx, out[i].InstanceID, out[i].RunID); err != nil {
			return nil, err
		}
	}
	return out, nil
}

// PruneSessions deletes sessions (and their proxies) not seen since before.
func (s *Store) PruneSessions(ctx context.Context, before time.Time) (int64, error) {
	res, err := s.q.ExecContext(ctx, "DELETE FROM sessions WHERE last_seen < ?", before.Unix())
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
