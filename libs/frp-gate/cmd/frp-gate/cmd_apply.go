package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/audit"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/config"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/declare"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// applyCmd: frp-gate apply [-f FILE] [--dry-run]
//
// It opens the same SQLite file as the running server (safe in WAL mode)
// and makes the whole change in one transaction. The server reads the
// database on every decision, so the change takes effect at once.
func applyCmd(args []string) int {
	fs := flag.NewFlagSet("apply", flag.ContinueOnError)
	file := fs.String("f", os.Getenv("FRP_GATE_CONFIG"), "config file (default: $FRP_GATE_CONFIG)")
	dryRun := fs.Bool("dry-run", false, "print what would change, change nothing")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if *file == "" {
		return fail("apply: no file; use -f FILE or set FRP_GATE_CONFIG")
	}
	f, err := declare.ParseFile(*file)
	if err != nil {
		return fail("apply: %v", err)
	}
	d, err := f.Resolve(declare.OSEnv())
	if err != nil {
		return fail("apply: %s is invalid, nothing was changed:\n%s", *file, indent(err.Error()))
	}
	st, err := store.Open(config.DBPath(os.Getenv))
	if err != nil {
		return fail("apply: open database: %v", err)
	}
	defer st.Close()
	ctx := audit.WithActor(context.Background(), audit.Actor{Source: audit.SourceApply, Who: *file})
	// Like at start, FRP_GATE_INSTANCE_KEY comes first (rolled back with a dry run).
	ensure, err := ensureInstance(ctx, os.Getenv, nil)
	if err != nil {
		return fail("apply: %v", err)
	}
	res, err := declare.ApplyAfter(ctx, st, d, *dryRun, ensure)
	if err != nil {
		return fail("apply: nothing was changed: %v", err)
	}
	for _, c := range res.Changes {
		fmt.Println(c)
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

func indent(s string) string { return "  " + strings.ReplaceAll(s, "\n", "\n  ") }
