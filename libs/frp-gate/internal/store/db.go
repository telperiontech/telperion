// Package store keeps frp-gate's state in a single SQLite file.
package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	_ "modernc.org/sqlite" // pure-Go driver, no cgo
)

var (
	// ErrNotFound is returned when a row does not exist.
	ErrNotFound = errors.New("not found")
	// ErrConflict is returned when a unique name is already taken.
	ErrConflict = errors.New("already exists")
	// ErrInUse is returned when a row is still referenced (e.g. a zone with grants).
	ErrInUse = errors.New("still in use")
)

// Store wraps the database. All methods are safe for concurrent use.
type Store struct {
	db  *sql.DB
	now func() time.Time
}

// Open opens (creating if needed) the database at path and migrates it.
// Use ":memory:" for tests.
func Open(path string) (*Store, error) {
	dsn := "file:" + path + "?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)"
	if path != ":memory:" {
		dsn += "&_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)"
	}
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// One connection: writes are tiny and this avoids SQLITE_BUSY between
	// connections (and keeps a ":memory:" database alive).
	db.SetMaxOpenConns(1)
	s := &Store{db: db, now: time.Now}
	if err := s.migrate(context.Background()); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return s, nil
}

// SetClock replaces the time source (tests).
func (s *Store) SetClock(now func() time.Time) { s.now = now }

// Close closes the database.
func (s *Store) Close() error { return s.db.Close() }

// Ping checks the database is usable (health check).
func (s *Store) Ping(ctx context.Context) error { return s.db.PingContext(ctx) }

func (s *Store) unix() int64 { return s.now().Unix() }

// mapErr turns SQLite constraint errors into the package's sentinel errors.
func mapErr(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	msg := err.Error()
	switch {
	case strings.Contains(msg, "UNIQUE constraint failed"):
		return ErrConflict
	case strings.Contains(msg, "FOREIGN KEY constraint failed"):
		return ErrInUse
	}
	return err
}

// prefixCols qualifies a comma-separated column list with a table alias.
func prefixCols(prefix, cols string) string {
	parts := strings.Split(cols, ",")
	for i, p := range parts {
		parts[i] = prefix + strings.TrimSpace(p)
	}
	return strings.Join(parts, ", ")
}

// affected returns ErrNotFound when a write touched no row.
func affected(res sql.Result, err error) error {
	if err != nil {
		return mapErr(err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
