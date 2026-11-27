# Beacon

A small self-hosted panel for the release lifecycle of packages across repos: where each version
stands (tagged, built, published, deployed), and which versions are stuck between two stages. See
the [design](DESIGN.md) and the [roadmap](ROADMAP.md).

**Status: Phase 0 (groundwork).** The image runs both listeners and serves an empty UI shell;
packages, adapters and the store come in Phase 1.

## Quick start

```sh
docker run -d --name beacon -p 7700:7700 -p 7701:7701 -v beacon-data:/data ghcr.io/telperiontech/beacon:latest
```

| Port | Listener | Serves |
| --- | --- | --- |
| 7700 | ingest | `/healthz` (later: GitHub webhooks, CDEvents, `/metrics`). The only part that may face the internet. |
| 7701 | admin | The UI (later: JSON API and SSE). Keep it behind a reverse proxy such as Caddy. |

The image is distroless (`static-debian12:nonroot`), multi-arch (amd64, arm64), keeps its data in
`/data`, and its `HEALTHCHECK` runs `beacon healthcheck`.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `BEACON_INGEST_ADDR` | `:7700` | Ingest listener address (`beacon healthcheck` asks its `/healthz`) |
| `BEACON_ADMIN_ADDR` | `:7701` | Admin listener address |
| `BEACON_LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error` |
| `GOMEMLIMIT` | `48MiB` | Go's soft memory limit; set in the image |

## Development

The Go module is built and tested in Docker; no local Go toolchain is needed. The UI stage reads
the workspace libraries it imports (`@telperion/ng-pack`, `@telperion/ng-ui`, ...) from the repo
root, passed as the named build context `workspace`, so plain `docker build apps/beacon` does not
work; use the Nx targets:

| Command | Does |
| --- | --- |
| `nx test beacon` | UI build, gzip budget check, `go vet`, `go test` (`docker build --target test`) |
| `nx build beacon` | The image `telperiontech/beacon:latest` |
| `nx run beacon:run` | Runs it: admin on <http://localhost:10505>, ingest on <http://localhost:10506> |
| `nx serve beacon-ui` | UI dev server on <http://localhost:10504>, `/api` proxied to 10505 |
| `nx run beacon-ui:check-budget` | Builds the UI and fails above 250 KB gzipped initial |

`nx build beacon-ui` writes to `internal/web/dist` (gitignored), where `go:embed` picks it up, so
with a local Go toolchain `go run ./cmd/beacon` works after a UI build.

### Checking that App-created tags start workflows

Beacon starts releases by creating tags with a GitHub App installation token and relies on the tag
push starting the package's `push: tags` workflow. `scripts/verify-app-tag-trigger.mjs` checks this
on a throwaway tag prefix: it creates one `beacon-probe-*` tag through the Releases API and one
through the Git refs API, waits for each to start
[`beacon-tag-probe.yml`](../../.github/workflows/beacon-tag-probe.yml) (which only echoes), and
deletes the tags and the release again. The runs stay in the Actions tab as evidence.

1. Install a GitHub App on the repo with **Contents: read and write** and **Actions: read**.
2. Mint an installation token
   ([GitHub docs](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)).
   It expires after an hour.
3. Make sure the commit you tag contains `.github/workflows/beacon-tag-probe.yml` (`--ref`, default
   `main`; before this is merged, push the branch and pass it).
4. Run it with the token in the environment, typed without echo so it stays out of the shell
   history:

   ```sh
   read -rs BEACON_PROBE_TOKEN && export BEACON_PROBE_TOKEN   # bash; PowerShell 7: $env:BEACON_PROBE_TOKEN = Read-Host -MaskInput
   node apps/beacon/scripts/verify-app-tag-trigger.mjs --repo OWNER/NAME --ref main
   unset BEACON_PROBE_TOKEN
   ```

It prints `PASS`/`FAIL` per API with the run's URL and the actor (the App's bot account), exits 0
only when both started a run, and never prints the token. If it is interrupted, delete leftover
`beacon-probe-*` tags and releases by hand.

### Release

`gh release create beacon-v0.1.0 --generate-notes` (or a pushed `beacon-vX.Y.Z` tag) runs
[`beacon.publish.yml`](../../.github/workflows/beacon.publish.yml): hadolint, the test stage, then
a multi-arch push to `ghcr.io/telperiontech/beacon`.

## License

[Apache-2.0](LICENSE)
