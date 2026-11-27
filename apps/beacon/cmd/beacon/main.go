// Command beacon is a small self-hosted panel for the release lifecycle of
// packages across repos. Phase 0: the two listeners and the embedded UI shell.
package main

import (
	"fmt"
	"log/slog"
	"os"
)

// version is set at build time with -ldflags "-X main.version=...".
var version = "dev"

const usage = `usage: beacon [command]

  (no command)   run the server
  healthcheck    exit 0 if the running server is healthy
  version        print the version

Configuration is read from BEACON_* environment variables; see the README.
`

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "version", "--version":
			fmt.Println(version)
			return
		case "healthcheck":
			os.Exit(healthcheck(os.Getenv))
		case "help", "-h", "--help":
			fmt.Print(usage)
			return
		default:
			fmt.Fprint(os.Stderr, usage)
			os.Exit(2)
		}
	}
	if err := serve(); err != nil {
		slog.Error("beacon stopped", "err", err)
		os.Exit(1)
	}
}
