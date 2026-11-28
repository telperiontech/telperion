package sqlitex

import (
	"bytes"
	"context"
	"path/filepath"
	"testing"
)

var migrations = []string{
	"CREATE TABLE a (x INTEGER)",
	"ALTER TABLE a ADD COLUMN y TEXT; INSERT INTO a VALUES (1, 'one')",
}

func TestOpenMigrates(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "t.db")
	db, err := Open(ctx, path, migrations[:1], Options{CacheKiB: 2048})
	if err != nil {
		t.Fatal(err)
	}
	db.Close()

	db, err = Open(ctx, path, migrations, Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var y string
	if err := db.QueryRow("SELECT y FROM a").Scan(&y); err != nil || y != "one" {
		t.Fatalf("after the second migration: %q %v", y, err)
	}

	if _, err := Open(ctx, path, migrations[:1], Options{}); err == nil {
		t.Error("an older program opened a newer schema")
	}
}

func TestBackup(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	db, err := Open(ctx, filepath.Join(dir, "t.db"), migrations, Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	dest := filepath.Join(dir, "copy.db")
	if err := Backup(ctx, db, dest, dir, nil); err != nil {
		t.Fatal(err)
	}
	if err := Backup(ctx, db, dest, dir, nil); err == nil {
		t.Error("an existing backup was overwritten")
	}
	var out bytes.Buffer
	if err := Backup(ctx, db, "-", dir, &out); err != nil {
		t.Fatal(err)
	}
	if !bytes.HasPrefix(out.Bytes(), []byte("SQLite format 3")) {
		t.Errorf("the stdout backup is not a database (%d bytes)", out.Len())
	}
}
