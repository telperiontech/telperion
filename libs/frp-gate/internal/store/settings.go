package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
)

// Secret returns a random value stored under key, creating it on first use
// (e.g. the admin session signing key, so sessions survive restarts).
func (s *Store) Secret(ctx context.Context, key string, size int) ([]byte, error) {
	var v []byte
	err := s.db.QueryRowContext(ctx, "SELECT value FROM settings WHERE key = ?", key).Scan(&v)
	if err == nil {
		return v, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	v = make([]byte, size)
	if _, err := rand.Read(v); err != nil {
		return nil, err
	}
	if _, err := s.db.ExecContext(ctx, "INSERT INTO settings (key, value) VALUES (?, ?)", key, v); err != nil {
		return nil, err
	}
	return v, nil
}
