package store

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

// TestMigrateV1Database: a 1.0 database keeps its rows and gets the new
// columns with managed = 0 (made in the UI).
func TestMigrateV1Database(t *testing.T) {
	path := filepath.Join(t.TempDir(), "v1.db")
	db, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatal(err)
	}
	for _, q := range []string{schemaV1, "PRAGMA user_version = 1",
		"INSERT INTO clients (name, token_hash, created_at) VALUES ('home-pi', 'h', 1)"} {
		if _, err := db.Exec(q); err != nil {
			t.Fatal(err)
		}
	}
	db.Close()

	st, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	ctx := context.Background()
	c, err := st.ClientByName(ctx, "home-pi")
	if err != nil || c.Managed || c.SecretManaged || c.TokenHash != "h" {
		t.Fatalf("migrated client: %+v %v", c, err)
	}
	if err := st.AddAudit(ctx, AuditEntry{Source: "ui", Action: "test"}); err != nil {
		t.Fatalf("audit table missing: %v", err)
	}
}

func TestWithTxRollsBack(t *testing.T) {
	st := openTest(t)
	ctx := context.Background()
	boom := errors.New("boom")
	err := st.WithTx(ctx, func(tx *Store) error {
		if _, err := tx.CreateZone(ctx, "a.example"); err != nil {
			return err
		}
		// Nested calls join the same transaction.
		return tx.WithTx(ctx, func(tx2 *Store) error {
			if _, err := tx2.CreateZone(ctx, "b.example"); err != nil {
				return err
			}
			return boom
		})
	})
	if !errors.Is(err, boom) {
		t.Fatalf("got %v", err)
	}
	if zs, _ := st.ListZones(ctx); len(zs) != 0 {
		t.Errorf("rolled-back zones remain: %v", zs)
	}
}

func TestBackup(t *testing.T) {
	dir := t.TempDir()
	st, err := Open(filepath.Join(dir, "live.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	ctx := context.Background()
	if _, err := st.CreateZone(ctx, "a.example"); err != nil {
		t.Fatal(err)
	}
	out := filepath.Join(dir, "copy.db")
	if err := st.Backup(ctx, out); err != nil {
		t.Fatal(err)
	}
	if err := st.Backup(ctx, out); err == nil {
		t.Error("backup overwrote an existing file")
	}
	b, _ := os.ReadFile(out)
	if len(b) < 16 || string(b[:15]) != "SQLite format 3" {
		t.Fatal("backup is not an SQLite file")
	}
	cp, err := Open(out)
	if err != nil {
		t.Fatal(err)
	}
	defer cp.Close()
	if zs, _ := cp.ListZones(ctx); len(zs) != 1 {
		t.Errorf("backup lacks data: %v", zs)
	}
}

func TestPruneAudit(t *testing.T) {
	st := openTest(t)
	ctx := context.Background()
	for range 5 {
		if err := st.AddAudit(ctx, AuditEntry{Source: "ui", Action: "x"}); err != nil {
			t.Fatal(err)
		}
	}
	if n, err := st.PruneAudit(ctx, 2); err != nil || n != 3 {
		t.Fatalf("pruned %d, %v", n, err)
	}
	es, _ := st.ListAudit(ctx, 0, 10)
	if len(es) != 2 || es[0].ID != 5 {
		t.Errorf("kept %+v", es)
	}
	if page, _ := st.ListAudit(ctx, 5, 10); len(page) != 1 || page[0].ID != 4 {
		t.Errorf("paging: %+v", page)
	}
}
