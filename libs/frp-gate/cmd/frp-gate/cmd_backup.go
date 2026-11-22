package main

import (
	"context"
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/config"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// backupCmd: frp-gate backup FILE|-
//
// VACUUM INTO writes a consistent copy while the server keeps running. With
// "-" the copy goes to stdout (written to a temporary file next to the
// database first), which suits `docker exec frp-gate frp-gate backup - > x.db`
// on a distroless image without a shell.
func backupCmd(args []string) int {
	if len(args) != 1 {
		return fail("usage: frp-gate backup FILE|-")
	}
	dbPath := config.DBPath(os.Getenv)
	st, err := store.Open(dbPath)
	if err != nil {
		return fail("backup: open database: %v", err)
	}
	defer st.Close()
	ctx := context.Background()

	if args[0] != "-" {
		if _, err := os.Stat(args[0]); !errors.Is(err, fs.ErrNotExist) {
			return fail("backup: %s already exists; choose a new file", args[0])
		}
		if err := st.Backup(ctx, args[0]); err != nil {
			return fail("backup: %v", err)
		}
		return 0
	}

	tmp, err := os.CreateTemp(filepath.Dir(dbPath), ".frp-gate-backup-*.db")
	if err != nil {
		return fail("backup: %v", err)
	}
	name := tmp.Name()
	tmp.Close()
	os.Remove(name) // VACUUM INTO needs a file that does not exist
	defer os.Remove(name)
	if err := st.Backup(ctx, name); err != nil {
		return fail("backup: %v", err)
	}
	f, err := os.Open(name)
	if err != nil {
		return fail("backup: %v", err)
	}
	defer f.Close()
	if _, err := io.Copy(os.Stdout, f); err != nil {
		return fail("backup: %v", err)
	}
	return 0
}
