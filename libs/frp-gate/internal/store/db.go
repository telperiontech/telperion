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

// querier is what *sql.DB and *sql.Tx have in common.
type querier interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// Store wraps the database. All methods are safe for concurrent use.
// Inside WithTx, a Store runs every query in that transaction.
type Store struct {
	db  *sql.DB
	q   querier // db, or the transaction of WithTx
	now func() time.Time
}

// Open opens (creating if needed) the database at path and migrates it.
// Use ":memory:" for tests.
func Open(path string) (*Store, error) {
	// _txlock=immediate: a transaction takes the write lock when it starts, so
	// a second process (frp-gate apply) waits for busy_timeout instead of
	// failing when it upgrades a read transaction.
	dsn := "file:" + path + "?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_txlock=immediate"
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
	s := &Store{db: db, q: db, now: time.Now}
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

// WithTx runs fn with a Store whose queries all run in one transaction. The
// transaction commits if fn returns nil and rolls back otherwise. Nested
// calls join the outer transaction.
func (s *Store) WithTx(ctx context.Context, fn func(tx *Store) error) error {
	if _, inTx := s.q.(*sql.Tx); inTx {
		return fn(s)
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if err := fn(&Store{db: s.db, q: tx, now: s.now}); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

// Backup writes a consistent copy of the database to path (VACUUM INTO). It
// works while frp-gate runs; path must not exist yet.
func (s *Store) Backup(ctx context.Context, path string) error {
	_, err := s.db.ExecContext(ctx, "VACUUM INTO ?", path)
	return err
}

// managedTables are the tables whose rows can be owned by the config file.
var managedTables = map[string]bool{
	"zones": true, "instances": true, "clients": true, "client_groups": true, "grants": true,
}

// SetManaged marks a row as owned by the config file (or releases it).
func (s *Store) SetManaged(ctx context.Context, table string, id int64, managed bool) error {
	if !managedTables[table] {
		return fmt.Errorf("table %q has no managed flag", table)
	}
	return affected(s.q.ExecContext(ctx, "UPDATE "+table+" SET managed = ? WHERE id = ?", managed, id))
}

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
