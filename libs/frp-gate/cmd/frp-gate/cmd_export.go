package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/telperiontech/telperion/libs/frp-gate/internal/config"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/declare"
	"github.com/telperiontech/telperion/libs/frp-gate/internal/store"
)

// exportCmd: frp-gate export — the whole database as a config file.
func exportCmd(args []string) int {
	if len(args) > 0 {
		return fail("export takes no arguments; redirect stdout to a file")
	}
	st, err := store.Open(config.DBPath(os.Getenv))
	if err != nil {
		return fail("export: open database: %v", err)
	}
	defer st.Close()
	f, err := declare.Export(context.Background(), st)
	if err != nil {
		return fail("export: %v", err)
	}
	fmt.Printf("# frp-gate %s export, %s\n", version, time.Now().UTC().Format(time.RFC3339))
	fmt.Println("# Tokens and plugin keys are SHA-256 hashes (token_sha256 / key_sha256): applying")
	fmt.Println("# this file keeps them. Replace them with token_env / key_env as you like.")
	if err := f.Encode(os.Stdout); err != nil {
		return fail("export: %v", err)
	}
	return 0
}
