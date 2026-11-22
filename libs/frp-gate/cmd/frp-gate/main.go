// Command frp-gate is a multi-tenant gateway for frp: an frps server plugin,
// a Caddy on-demand TLS "ask" endpoint and a small admin UI.
package main

import (
	"fmt"
	"log/slog"
	"os"
)

// version is set at build time with -ldflags "-X main.version=...".
var version = "dev"

const usage = `usage: frp-gate [command]

  (no command)               run the server
  apply [-f FILE] [--dry-run] apply a declarative config file (default: $FRP_GATE_CONFIG)
  export                     print the current state as a config file (secrets as SHA-256)
  backup FILE|-              write a consistent copy of the database (- = stdout)
  healthcheck                exit 0 if the running server is healthy
  version                    print the version

Configuration is read from FRP_GATE_* environment variables; see the README.
`

func main() {
	if len(os.Args) > 1 {
		args := os.Args[2:]
		switch os.Args[1] {
		case "version", "--version":
			fmt.Println(version)
			return
		case "healthcheck":
			os.Exit(healthcheck())
		case "apply":
			os.Exit(applyCmd(args))
		case "export":
			os.Exit(exportCmd(args))
		case "backup":
			os.Exit(backupCmd(args))
		case "help", "-h", "--help":
			fmt.Print(usage)
			return
		default:
			fmt.Fprint(os.Stderr, usage)
			os.Exit(2)
		}
	}
	if err := serve(); err != nil {
		slog.Error("frp-gate stopped", "err", err)
		os.Exit(1)
	}
}

// fail prints an error for a CLI command and returns its exit code.
func fail(format string, args ...any) int {
	fmt.Fprintf(os.Stderr, "frp-gate: "+format+"\n", args...)
	return 1
}
