// Command beacon is a small self-hosted panel for the release lifecycle of
// packages across repos: where each version stands (tagged, built, published,
// deployed) and which versions are stuck between two stages.
package main

import (
	"fmt"
	"log/slog"
	"os"
	"strings"

	"github.com/telperiontech/telperion/libs/go-kit/health"
)

// version is set at build time with -ldflags "-X main.version=...".
var version = "dev"

const usage = `usage: beacon [command]

  (no command)                 run the server
  apply [-f FILE] [--dry-run]  apply the config file (default: $BEACON_CONFIG)
  export                       print the stored config as YAML
  backup FILE|-                write a consistent copy of the database (- = stdout)
  healthcheck                  exit 0 if the running server is healthy
  version                      print the version

Settings are read from BEACON_* environment variables; see the README.
`

func main() {
	if len(os.Args) > 1 {
		args := os.Args[2:]
		switch os.Args[1] {
		case "version", "--version":
			fmt.Println(version)
			return
		case "healthcheck":
			s, err := readSettings(os.Getenv, false)
			if err != nil {
				os.Exit(1)
			}
			os.Exit(health.Check(s.IngestAddr))
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
		slog.Error("beacon stopped", "err", err)
		os.Exit(1)
	}
}

// fail prints an error for a CLI command and returns its exit code.
func fail(format string, args ...any) int {
	fmt.Fprintf(os.Stderr, "beacon: "+format+"\n", args...)
	return 1
}

func indent(s string) string { return "  " + strings.ReplaceAll(s, "\n", "\n  ") }
