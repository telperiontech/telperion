package store

import (
	"context"
	"time"
)

// Client is a named token holder (a person or a machine).
type Client struct {
	ID               int64     `json:"id"`
	Name             string    `json:"name"`
	TokenHash        string    `json:"-"`
	Disabled         bool      `json:"disabled"`
	Note             string    `json:"note"`
	CreatedAt        time.Time `json:"created_at"`
	LastLoginAt      time.Time `json:"last_login_at"`
	LastLoginAddr    string    `json:"last_login_addr"`
	LastLoginVersion string    `json:"last_login_version"`
	LastLoginHost    string    `json:"last_login_host"`
}

const clientCols = "id, name, token_hash, disabled, note, created_at, last_login_at, last_login_addr, last_login_version, last_login_host"

type scanner interface{ Scan(dest ...any) error }

func scanClient(row scanner) (Client, error) {
	var c Client
	var created, lastLogin int64
	err := row.Scan(&c.ID, &c.Name, &c.TokenHash, &c.Disabled, &c.Note, &created,
		&lastLogin, &c.LastLoginAddr, &c.LastLoginVersion, &c.LastLoginHost)
	c.CreatedAt = time.Unix(created, 0)
	if lastLogin > 0 {
		c.LastLoginAt = time.Unix(lastLogin, 0)
	}
	return c, err
}

// CreateClient adds a client. name must be a validated label.
func (s *Store) CreateClient(ctx context.Context, name, tokenHash, note string) (Client, error) {
	now := s.unix()
	res, err := s.db.ExecContext(ctx,
		"INSERT INTO clients (name, token_hash, note, created_at) VALUES (?, ?, ?, ?)",
		name, tokenHash, note, now)
	if err != nil {
		return Client{}, mapErr(err)
	}
	id, _ := res.LastInsertId()
	return Client{ID: id, Name: name, TokenHash: tokenHash, Note: note, CreatedAt: time.Unix(now, 0)}, nil
}

// ClientByName finds a client by its name (the frpc user).
func (s *Store) ClientByName(ctx context.Context, name string) (Client, error) {
	c, err := scanClient(s.db.QueryRowContext(ctx, "SELECT "+clientCols+" FROM clients WHERE name = ?", name))
	return c, mapErr(err)
}

// ClientByID finds a client by id.
func (s *Store) ClientByID(ctx context.Context, id int64) (Client, error) {
	c, err := scanClient(s.db.QueryRowContext(ctx, "SELECT "+clientCols+" FROM clients WHERE id = ?", id))
	return c, mapErr(err)
}

// ListClients returns all clients ordered by name.
func (s *Store) ListClients(ctx context.Context) ([]Client, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT "+clientCols+" FROM clients ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Client
	for rows.Next() {
		c, err := scanClient(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// SetClientDisabled enables or disables a client.
func (s *Store) SetClientDisabled(ctx context.Context, id int64, disabled bool) error {
	return affected(s.db.ExecContext(ctx, "UPDATE clients SET disabled = ? WHERE id = ?", disabled, id))
}

// SetClientToken replaces a client's token (rotation).
func (s *Store) SetClientToken(ctx context.Context, id int64, tokenHash string) error {
	return affected(s.db.ExecContext(ctx, "UPDATE clients SET token_hash = ? WHERE id = ?", tokenHash, id))
}

// RecordLogin stores where a client last logged in from.
func (s *Store) RecordLogin(ctx context.Context, id int64, addr, version, host string) error {
	_, err := s.db.ExecContext(ctx,
		"UPDATE clients SET last_login_at = ?, last_login_addr = ?, last_login_version = ?, last_login_host = ? WHERE id = ?",
		s.unix(), addr, version, host, id)
	return err
}

// DeleteClient removes a client with its grants, memberships and sessions.
func (s *Store) DeleteClient(ctx context.Context, id int64) error {
	return affected(s.db.ExecContext(ctx, "DELETE FROM clients WHERE id = ?", id))
}
