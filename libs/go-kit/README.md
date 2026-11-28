# go-kit

Shared Go packages of this repo's small self-hosted services. Beacon uses it today; frp-gate has
the originals these were taken from and can switch over in its own change.

It is not published as a separate module: consumers in this repo use it through a `replace` in
their `go.mod`, and their Dockerfiles copy `libs/go-kit` from the repo root (the `workspace` build
context).

```go
require github.com/telperiontech/telperion/libs/go-kit v0.0.0
replace github.com/telperiontech/telperion/libs/go-kit => ../../libs/go-kit
```

| Package | What |
| --- | --- |
| `envx` | `Or(getenv, key, def)`; `Secret(getenv, NAME)` reads `NAME` or the file in `NAME_FILE` (Docker secrets) |
| `httpserver` | `New(addr, h)` with conservative timeouts; `Run(ctx, grace, servers...)` serves several listeners and shuts them down together |
| `health` | `Handler(ping)` for `/healthz`; `Check(addr)` for a `healthcheck` subcommand in distroless images |
| `session` | One admin password: constant-time check, HMAC-signed expiring cookies (`HttpOnly`, `SameSite=Strict`, `Secure` behind HTTPS), a delay after a wrong password, optional HTTP Basic |
| `sqlitex` | Pure-Go SQLite: WAL, one connection, `BEGIN IMMEDIATE` with a busy timeout, migrations by `user_version`, `VACUUM INTO` backups (also to stdout) |
| `promtext` | The Prometheus text format without a client library |
| `audit` | Who performs an action, carried in a `context.Context` |
| `spa` | Serves a single-page app from an `fs.FS`: hashed files cached forever, client routes get `index.html`, no directory listings |

Pair `session` with `http.CrossOriginProtection` for CSRF.

## Development

`nx test go-kit` runs `go vet` and `go test` in Docker. Beacon's test stage runs them too.

## License

[Apache-2.0](LICENSE)
