# Beacon

A small self-hosted panel for the release lifecycle of packages across repos: where each version
stands (tagged, built, published, deployed), which versions are stuck between two stages, and
buttons to release, deploy and re-run. See the [design](DESIGN.md) and the [roadmap](ROADMAP.md).

**Status: Phase 2 (single actions).** Beacon observes tags, CI runs, registries and deployments and
shows the gaps between them, live. A release, a deploy or a re-run of a failed build is a button
with a preview, and Beacon follows it to the end of the chain. Chained release plans come in
Phase 3.

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
| 7700 | ingest | `/healthz`, `/metrics`, `POST /hooks/github` (App webhooks), `POST /cdevents`. The only part that may face the internet, and only if push events are wanted. |
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
github:                     # a GitHub App (permissions below)
  app_id: 123456
  private_key_file: /run/secrets/beacon-github-app.pem
  webhook_secret_env: BEACON_GITHUB_WEBHOOK_SECRET   # optional: App webhooks

targets:
  coolify-main:
    coolify: { url: https://coolify.example.com, token_env: COOLIFY_TOKEN }
    limit: 1                # deploys at a time (default 1)

cdevents:                   # optional: who may POST CDEvents to /cdevents
  sources:
    - { name: home-ci, token_env: BEACON_CDEVENTS_HOME_CI, packages: [site] }

projects:
  - name: telperion
    repo: telperiontech/telperion         # or { git: https://git.example.com/x/y.git, token_env: ... }
    tag: "{package}-v{version}"           # the default
    branch: main                          # releases tag its head; default: the repo's default branch
    release: { github-release: { notes: generate } }
    ci: { github-actions: { workflow: "{package}.publish.yml" } }
    packages:
      js-utils: { path: libs/js-utils, artifact: { npm: "@telperion/js-utils" } }
      docs: { ci: none, release: none }
      frp-gate:
        path: libs/frp-gate
        artifact: { oci: { image: ghcr.io/telperiontech/frp-gate, platforms: [linux/amd64, linux/arm64] } }
        deploy:
          - coolify-main: { app: "<application uuid>" }
          - http-check: { url: "https://gate.example.com/healthz", version: { header: X-Version } }

  - name: elsewhere
    repo: { git: https://git.example.com/acme/site.git }
    release: { webhook: { url: https://ci.example.com/hooks/release, secret_env: SITE_HOOK_SECRET } }
    packages:
      site:
        ci: cdevents                      # built is only reported, by CDEvents
        deploy:
          - cdevents: { environment: staging }
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
- **Release triggers** (`release:`, project default, package override, `none` to turn it off):
  `github-release` (a GitHub release, or with `tag_only: true` only the tag, at the branch head;
  `notes: generate | none`), `github-dispatch` (`workflow: release.yml`, `inputs:` with
  `{package}`, `{version}`, `{tag}`, `{bump}`; default `package` and `version`) and `webhook`
  (`url`, `secret_env`/`secret_file`; see [Actions](#actions)).
- `path` is the package's folder: the unreleased-changes count only includes commits that touch
  it. Without it every commit on the branch counts.
- Without a `github` block GitHub is read anonymously (60 requests an hour; polling slows down to
  fit), unreleased changes are not counted, and nothing can be written to GitHub.
- **GitHub App permissions:** Metadata read, Contents and Actions read (observing) or read and
  write (releases, dispatches, re-runs). Beacon mints read-only tokens for polling and, for each
  action, a write token limited to that one repo. Webhook events: `push`, `create`, `release`,
  `workflow_run`, `registry_package`.
- **Not verified yet:** the Coolify adapter (running version and deploys) follows the v4 API docs
  (`docker_registry_image_tag`, `status`, `/deploy?uuid=`, `/deployments/{uuid}`) and has not run
  against a live instance.

## Actions

The package page offers what the package's adapters support: **release** (patch, minor or major
from the latest `{package}-v{version}` tag), **deploy** a published version on a Coolify target
that does not run it, and **re-run** the failed jobs of a failed GitHub Actions build. Each action:

1. **Preview.** The exact version change, the tag and the commit it will point at, the unreleased
   commits, what the trigger will do, and what it would wait for. Nothing is written. A major
   version change needs its own tick.
2. **Start.** Beacon computes the preview again; if anything moved (a new tag, a new commit on the
   branch), it shows the new preview instead of starting.
3. **Run.** An action is a one-step plan run: it takes the package's lock (one active step per
   package), for a deploy a slot on its target (`limit`), and a repo lock only while it writes.
   Before writing it checks whether the result exists already (the tag, the running version) and
   then follows it instead of firing again. Restarts are safe: the intent is stored before the
   write, and a dispatch or webhook is never sent twice.
4. **Done when the chain says so.** A release is done when its last stage (e.g. `published`) is ok
   for the new version, and failed when a stage on the way fails, when the tag does not appear
   within 30 minutes, or after 2 hours without progress. A deploy is done when the target reports
   the version. The **Runs** page and the package page follow it live; a running action can be
   cancelled (what it started, such as a CI run, goes on).

Every start, step outcome and cancel is in the audit log, with who did it (`ui` or `api`).

The `webhook` trigger POSTs `{"event": "release", "package", "version", "tag", "bump", "branch",
"commit", "plan"}` with `X-Beacon-Signature-256: sha256=<hex HMAC-SHA256 of the body>` (GitHub's
scheme) and `X-Beacon-Delivery`, which is the same for a retried step.

### Push events

- **GitHub App webhooks** (`POST /hooks/github`, checked with the webhook secret) make Beacon poll
  the concerned jobs at once: tags, CI runs, packages. They never write state themselves.
- **CDEvents** (`POST /cdevents`, `Authorization: Bearer <source token>`; structured, batched or
  binary CloudEvents) become observations: `build.started/finished` → built, `artifact.packaged/
  published` → published, `service.deployed/upgraded/rolledback` → deployed on the event's
  environment. The package comes from the artifact's purl: `pkg:npm/...` and `pkg:oci/...` by the
  artifact coordinates in the config, `pkg:generic/<package>@<version>` by Beacon's package name.
  Events that map to no package are recorded in the audit log as `cdevents.unmatched`. A poll that
  disagrees wins at its next run.

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
| `GET /api/overview` | Packages with their newest version, gaps, unreleased changes, possible actions and active run; stuck gaps first |
| `GET /api/packages/{name}` | Every version with its chain, recent events and runs |
| `GET /api/packages/{name}/events?before=&limit=` | Older events |
| `POST /api/actions/preview` | `{"kind": "release", "package", "bump"}` (or `"version"`), `{"kind": "deploy", "package", "version", "target"}`, `{"kind": "rerun", "package", "version"}` → the preview; writes nothing |
| `POST /api/actions` | The same request plus `"confirm": {"fingerprint", "major"}` from the preview → `201 {"run": id}`; `409` (moved), `422` (errors) or `428` (major not ticked) with the current preview |
| `GET /api/runs?before=&limit=`, `GET /api/runs/{id}` | Plan runs and their steps |
| `POST /api/runs/{id}/cancel` | Cancels a running run |
| `GET /api/status` | The poll jobs: tier, last and next poll, last error |
| `GET /api/audit?before=&limit=` | Logins, config applies, runs, unmatched CDEvents |
| `GET /api/events` | Server-sent events: `{"packages": [...], "runs": [...]}` whenever packages or runs change |

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
