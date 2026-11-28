// Package store keeps Beacon's state in one SQLite file: the catalog from the
// YAML config, observations (latest state per version and stage), the event
// log and the audit log.
package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"io"
	"path/filepath"
	"time"

	"github.com/telperiontech/telperion/libs/go-kit/sqlitex"
)

// querier is what *sql.DB and *sql.Tx have in common.
type querier interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// Store wraps the database. All methods are safe for concurrent use. Inside
// WithTx, a Store runs every query in that transaction.
type Store struct {
	db   *sql.DB
	q    querier
	now  func() time.Time
	path string
}

// cacheKiB keeps SQLite's page cache small (the memory target is < 64 MB RSS).
const cacheKiB = 2048

// Open opens (creating if needed) the database at path and migrates it.
// Use ":memory:" for tests.
func Open(ctx context.Context, path string) (*Store, error) {
	db, err := sqlitex.Open(ctx, path, migrations, sqlitex.Options{CacheKiB: cacheKiB})
	if err != nil {
		return nil, err
	}
	return &Store{db: db, q: db, now: time.Now, path: path}, nil
}

// SetClock replaces the time source (tests).
func (s *Store) SetClock(now func() time.Time) { s.now = now }

// Close closes the database.
func (s *Store) Close() error { return s.db.Close() }

// Ping checks that the database answers (health check).
func (s *Store) Ping(ctx context.Context) error { return s.db.PingContext(ctx) }

// Backup writes a consistent copy to dest ("-": stdout) while Beacon runs.
func (s *Store) Backup(ctx context.Context, dest string, stdout io.Writer) error {
	return sqlitex.Backup(ctx, s.db, dest, filepath.Dir(s.path), stdout)
}

// WithTx runs fn with a Store whose queries all run in one transaction, which
// commits if fn returns nil. Nested calls join the outer transaction.
func (s *Store) WithTx(ctx context.Context, fn func(tx *Store) error) error {
	if _, inTx := s.q.(*sql.Tx); inTx {
		return fn(s)
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if err := fn(&Store{db: s.db, q: tx, now: s.now, path: s.path}); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

// Secret returns a random value stored under key, creating it on first use
// (the session signing key, so sessions survive restarts).
func (s *Store) Secret(ctx context.Context, key string, size int) ([]byte, error) {
	var v []byte
	err := s.q.QueryRowContext(ctx, "SELECT value FROM settings WHERE key = ?", key).Scan(&v)
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
	if _, err := s.q.ExecContext(ctx, "INSERT INTO settings (key, value) VALUES (?, ?)", key, v); err != nil {
		return nil, err
	}
	return v, nil
}

func (s *Store) unix() int64 { return s.now().Unix() }
