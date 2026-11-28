# Beacon

A small self-hosted panel for the release lifecycle of packages across repos: where each version
stands (tagged, built, published, deployed), and which versions are stuck between two stages. See
the [design](DESIGN.md) and the [roadmap](ROADMAP.md).

**Status: Phase 1 (read-only overview).** Beacon observes tags, CI runs, registries and
deployments and shows the gaps between them, live. Releasing and deploying from Beacon come in
Phase 2.

## Quick start

```sh
docker run -d --name beacon -p 7700:7700 -p 7701:7701 \
  -e BEACON_ADMIN_PASSWORD_FILE=/run/secrets/beacon-admin \
  -e BEACON_CONFIG=/config/beacon.yaml \
  -v ./beacon.yaml:/config/beacon.yaml:ro \
  -v ./secrets:/run/secrets:ro \
  -v beacon-data:/data \
  ghcr.io/telperiontech/beacon:latest
```

Open <http://localhost:7701> and log in with the admin password.
[examples/beacon.yaml](examples/beacon.yaml) is the config for this repo's own packages.

| Port | Listener | Serves |
| --- | --- | --- |
| 7700 | ingest | `/healthz`, `/metrics` (later: GitHub webhooks, CDEvents). The only part that may face the internet. |
| 7701 | admin | The UI, the JSON API and its SSE stream. Keep it behind a reverse proxy such as Caddy. |

The image is distroless (`static-debian12:nonroot`), multi-arch (amd64, arm64), keeps its SQLite
database in `/data`, and its `HEALTHCHECK` runs `beacon healthcheck`.

## Settings

| Variable | Default | Meaning |
| --- | --- | --- |
| `BEACON_ADMIN_PASSWORD` / `_FILE` | (required) | Admin password, at least 12 characters |
| `BEACON_CONFIG` | | YAML config applied at every start; an invalid file stops the start |
| `BEACON_DB` | `/data/beacon.db` | SQLite database |
| `BEACON_INGEST_ADDR` | `:7700` | Ingest listener (`beacon healthcheck` asks its `/healthz`) |
| `BEACON_ADMIN_ADDR` | `:7701` | Admin listener |
| `BEACON_POLL_HOT` / `_WARM` / `_COLD` | `15s` / `2m` / `15m` | Poll intervals: a stage in progress / a change in the last 30 min / everything else |
| `BEACON_POLL_WORKERS` | `4` | Concurrent polls |
| `BEACON_LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error` |
| `GOMEMLIMIT` | `48MiB` | Go's soft memory limit; set in the image |

## Config file

One YAML file binds packages to platforms ([design/config.md](design/config.md)). Parsing is strict
(unknown keys are errors), everything is validated before anything changes, and the whole file is
applied in one transaction. Secrets are never in the file: `token_env`, `token_file` and
`private_key_file` name where they are.

```yaml
github:                     # a GitHub App with Metadata, Contents and Actions: read
  app_id: 123456
  private_key_file: /run/secrets/beacon-github-app.pem

targets:
  coolify-main:
    coolify: { url: https://coolify.example.com, token_env: COOLIFY_TOKEN }

projects:
  - name: telperion
    repo: telperiontech/telperion         # or { git: https://git.example.com/x/y.git, token_env: ... }
    tag: "{package}-v{version}"           # the default
    ci: { github-actions: { workflow: "{package}.publish.yml" } }
    packages:
      js-utils: { artifact: { npm: "@telperion/js-utils" } }
      docs: { ci: none }
      frp-gate:
        artifact: { oci: { image: ghcr.io/telperiontech/frp-gate, platforms: [linux/amd64, linux/arm64] } }
        deploy:
          - coolify-main: { app: "<application uuid>" }
          - http-check: { url: "https://gate.example.com/healthz", version: { header: X-Version } }
```

- A package's **chain** is its configured stages: `tagged` always, `built` with `ci`, `published`
  with `artifact`, `deployed` with `deploy`. Package names are unique across projects.
- Adapters: the `git` source (smart HTTP, any host; GitHub repos through the App), `github-actions`,
  `npm` (any npm registry: `{ name, registry, token_env }`), `oci` (any distribution registry; the
  newest version is checked for every listed platform), `coolify` (the running image tag) and
  `http-check` (the version from a header, a JSON pointer or a regex).
- A **gap** is a version whose stage is ok while the next one is missing or failed. It counts as
  stuck when it failed, or after 10 min (built), 45 min (published) or 24 h (deployed). Versions
  older than the newest one that completed its chain are not reported.
- Without a `github` block GitHub is read anonymously (60 requests an hour; polling slows down to
  fit).
- **Not verified yet:** the Coolify adapter follows the v4 API docs (`docker_registry_image_tag`,
  `status`) and has not run against a live instance.

## Commands

Run them next to the server with `docker exec beacon beacon ...` (same database, WAL mode).

| Command | Does |
| --- | --- |
| `beacon apply [-f FILE] [--dry-run]` | Applies a config file (default `$BEACON_CONFIG`); the server picks it up within 30 s |
| `beacon export` | Prints the stored config as YAML |
| `beacon backup FILE` or `beacon backup -` | Writes a consistent copy of the database (`-`: to stdout) |
| `beacon healthcheck` | Exit 0 when the server answers `/healthz` |

## API

Under `/api` on the admin listener, with the UI's session cookie or HTTP Basic auth (any user name,
the admin password):

| Endpoint | Returns |
| --- | --- |
| `GET /api/overview` | Packages with their newest version and gaps; stuck gaps first |
| `GET /api/packages/{name}` | Every version with its chain, and recent events |
| `GET /api/packages/{name}/events?before=&limit=` | Older events |
| `GET /api/status` | The poll jobs: tier, last and next poll, last error |
| `GET /api/audit?before=&limit=` | Logins and config applies |
| `GET /api/events` | Server-sent events: `{"packages": [...]}` whenever packages change |

`/metrics` on the ingest listener: `beacon_packages`, `beacon_gaps{stage}`,
`beacon_gaps_stuck{stage}`, `beacon_polls_total{layer,result}`.

## Development

The Go module is built and tested in Docker; no local Go toolchain is needed. The UI stage reads
the workspace libraries it imports (`@telperion/ng-pack`, `@telperion/ng-ui`, ...) and the Go stages
read [go-kit](../../libs/go-kit) from the repo root, passed as the named build context `workspace`,
so plain `docker build apps/beacon` does not work; use the Nx targets:

| Command | Does |
| --- | --- |
| `nx test beacon` | UI build, gzip budget check, `go vet` and `go test` of Beacon and go-kit |
| `nx build beacon` | The image `telperiontech/beacon:latest` |
| `nx run beacon:run` | Runs it (password `change-me-please`, no config): admin on <http://localhost:10505>, ingest on <http://localhost:10506> |
| `nx run beacon:rss-check` | The memory check below |
| `nx serve beacon-ui` | UI dev server on <http://localhost:10504>, `/api` proxied to 10505 |
| `nx run beacon-ui:check-budget` | Builds the UI and fails above 250 KB gzipped initial |

`nx build beacon-ui` writes to `internal/web/dist` (gitignored), where `go:embed` picks it up, so
with a local Go toolchain `go run ./cmd/beacon` works after a UI build.

### Memory check

The target is under 64 MB RSS. `test/rss/run.sh` starts the image next to
[`test/fakeplatform`](test/fakeplatform), a server that impersonates every platform Beacon reads (git,
the GitHub App and Actions APIs, an npm and an OCI registry, Coolify, http-check endpoints) over a
catalog of 30 packages whose versions keep moving through their chains. Beacon polls it with short
intervals for five minutes (`DURATION`); the check fails above `LIMIT_MB` (64), when packages are
missing or no gap is seen, or when a poll job ends in an error. CI runs it natively on amd64 and
arm64 before publishing.

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
[`beacon.publish.yml`](../../.github/workflows/beacon.publish.yml): hadolint, the test stage and
the memory check on both architectures, then a multi-arch push to `ghcr.io/telperiontech/beacon`.

## License

[Apache-2.0](LICENSE)
