package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"github.com/telperiontech/telperion/apps/beacon/internal/declare"
	"github.com/telperiontech/telperion/apps/beacon/internal/store"
	"github.com/telperiontech/telperion/libs/go-kit/audit"
)

// applyCmd: beacon apply [-f FILE] [--dry-run]
//
// It opens the same SQLite file as the running server (safe in WAL mode, as a
// second process via docker exec) and makes the whole change in one
// transaction. The server notices the new catalog revision within 30 seconds.
func applyCmd(args []string) int {
	fs := flag.NewFlagSet("apply", flag.ContinueOnError)
	file := fs.String("f", os.Getenv("BEACON_CONFIG"), "config file (default: $BEACON_CONFIG)")
	dryRun := fs.Bool("dry-run", false, "print what would change, change nothing")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if *file == "" {
		return fail("apply: no file; use -f FILE or set BEACON_CONFIG")
	}
	f, err := declare.ParseFile(*file)
	if err != nil {
		return fail("apply: %v", err)
	}
	c, err := f.Resolve(declare.OSEnv())
	if err != nil {
		return fail("apply: %s is invalid, nothing was changed:\n%s", *file, indent(err.Error()))
	}
	st, code := openStore()
	if st == nil {
		return code
	}
	defer st.Close()
	ctx := audit.WithActor(context.Background(), audit.Actor{Source: "apply", Who: *file})
	res, err := declare.Apply(ctx, st, c, *dryRun)
	if err != nil {
		return fail("apply: nothing was changed: %v", err)
	}
	for _, ch := range res.Changes {
		fmt.Println(ch)
	}
	switch {
	case len(res.Changes) == 0:
		fmt.Println("No changes: the database matches the file.")
	case *dryRun:
		fmt.Printf("Dry run: %d change(s) would be made. Nothing was changed.\n", len(res.Changes))
	default:
		fmt.Printf("Applied %d change(s).\n", len(res.Changes))
	}
	return 0
}

// exportCmd: beacon export — the stored config as YAML (secret references
// only; secrets are never stored).
func exportCmd(args []string) int {
	if len(args) != 0 {
		return fail("usage: beacon export")
	}
	st, code := openStore()
	if st == nil {
		return code
	}
	defer st.Close()
	c, err := st.LoadCatalog(context.Background())
	if err != nil {
		return fail("export: %v", err)
	}
	out, err := declare.Export(c)
	if err != nil {
		return fail("export: %v", err)
	}
	_, _ = os.Stdout.Write(out)
	return 0
}

// backupCmd: beacon backup FILE|- — a consistent copy while Beacon runs.
func backupCmd(args []string) int {
	if len(args) != 1 {
		return fail("usage: beacon backup FILE|-")
	}
	st, code := openStore()
	if st == nil {
		return code
	}
	defer st.Close()
	if err := st.Backup(context.Background(), args[0], os.Stdout); err != nil {
		return fail("backup: %v", err)
	}
	return 0
}

func openStore() (*store.Store, int) {
	s, err := readSettings(os.Getenv, false)
	if err != nil {
		return nil, fail("%v", err)
	}
	st, err := store.Open(context.Background(), s.DBPath)
	if err != nil {
		return nil, fail("open database %s: %v", s.DBPath, err)
	}
	return st, 0
}
