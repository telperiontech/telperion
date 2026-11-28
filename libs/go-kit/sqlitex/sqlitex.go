// Package sqlitex opens a service's single SQLite file the way frp-gate and
// Beacon need it: pure Go (no cgo), WAL, one connection, write-locking
// transactions with a busy timeout (so a CLI in a second process waits instead
// of failing), migrations by PRAGMA user_version, and online backups.
package sqlitex

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"

	_ "modernc.org/sqlite" // registers the "sqlite" driver
)

// Options tune Open. The zero value is fine.
type Options struct {
	// CacheKiB limits SQLite's page cache (PRAGMA cache_size = -CacheKiB);
	// 0 keeps SQLite's default (2 MiB).
	CacheKiB int
}

// Open opens (creating if needed) the database at path and applies the
// migrations that have not run yet. Use ":memory:" for tests.
//
// migrations run in order, each in its own transaction; user_version records
// how many ran. Never edit a released migration: append a new one.
func Open(ctx context.Context, path string, migrations []string, o Options) (*sql.DB, error) {
	// _txlock=immediate: a transaction takes the write lock when it starts, so a
	// second process waits for busy_timeout instead of failing on upgrade.
	dsn := "file:" + path + "?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_txlock=immediate"
	if path != ":memory:" {
		dsn += "&_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)"
	}
	if o.CacheKiB > 0 {
		dsn += fmt.Sprintf("&_pragma=cache_size(-%d)", o.CacheKiB)
	}
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// One connection: writes are small, it avoids SQLITE_BUSY between
	// connections, and it keeps a ":memory:" database alive.
	db.SetMaxOpenConns(1)
	if err := Migrate(ctx, db, migrations); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return db, nil
}

// Migrate applies migrations[user_version:].
func Migrate(ctx context.Context, db *sql.DB, migrations []string) error {
	var version int
	if err := db.QueryRowContext(ctx, "PRAGMA user_version").Scan(&version); err != nil {
		return err
	}
	if version > len(migrations) {
		return fmt.Errorf("database schema version %d is newer than this program (%d)", version, len(migrations))
	}
	for i := version; i < len(migrations); i++ {
		if err := migrateOne(ctx, db, i+1, migrations[i]); err != nil {
			return err
		}
	}
	return nil
}

func migrateOne(ctx context.Context, db *sql.DB, version int, stmt string) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, stmt); err != nil {
		return fmt.Errorf("migration %d: %w", version, err)
	}
	if _, err := tx.ExecContext(ctx, fmt.Sprintf("PRAGMA user_version = %d", version)); err != nil {
		return err
	}
	return tx.Commit()
}

// Backup writes a consistent copy of the database to dest with VACUUM INTO,
// while the service keeps running; an existing dest is never overwritten.
// dest "-" writes the copy to stdout through a temporary file in tmpDir (e.g.
// the database's directory), which suits `docker exec svc svc backup - > copy.db`
// on a distroless image.
func Backup(ctx context.Context, db *sql.DB, dest, tmpDir string, stdout io.Writer) error {
	if dest != "-" {
		if _, err := os.Stat(dest); !errors.Is(err, fs.ErrNotExist) {
			return fmt.Errorf("%s already exists; choose a new file", dest)
		}
		_, err := db.ExecContext(ctx, "VACUUM INTO ?", dest)
		return err
	}
	tmp, err := os.CreateTemp(tmpDir, ".backup-*.db")
	if err != nil {
		return err
	}
	name := tmp.Name()
	tmp.Close()
	os.Remove(name) // VACUUM INTO needs a file that does not exist yet
	defer os.Remove(name)
	if _, err := db.ExecContext(ctx, "VACUUM INTO ?", name); err != nil {
		return err
	}
	f, err := os.Open(name)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(stdout, f)
	return err
}
