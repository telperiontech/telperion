# Beacon design

Beacon is a small self-hosted panel for the release lifecycle of packages across repos. It shows
where each version of each package stands (tagged, built, published, deployed), makes the **gaps**
visible ("tagged but not published", "image ready but not deployed"), and runs single releases and
chained release plans safely. The name comes from the beacons of Gondor: one lights the next, like
chained releases.

This is the design plan. Nothing is built yet; the [roadmap](ROADMAP.md) lists the phases. Details
live in sibling files:

- [design/adapters.md](design/adapters.md): adapter interfaces per layer, the MVP set, CDEvents inbound
- [design/plans.md](design/plans.md): one-click actions, release plans (DAG), the release mechanism
- [design/config.md](design/config.md): the YAML config and catalog discovery

## Goals and limits

- **A cockpit, not an engine.** GitHub Actions (or GitLab CI, Jenkins, ...) builds and publishes.
  Beacon triggers, watches and connects. It never runs build steps itself and it is not a general
  workflow engine: no conditions, loops or data passing between steps (see
  [design/plans.md](design/plans.md#what-plans-are-not)).
- **Gaps first.** The main screen answers "what is stuck between two stages, and since when".
- **The only required base is git + CI + tag-based releases.** Everything else (registries,
  runtimes, GitHub-specific features) is an optional adapter. A repo on any git host whose CI
  publishes on a tag push can be tracked with the generic adapters alone.
- **Small.** One static binary, SQLite, no Postgres/Redis/queue. It must run on a 1 GB amd64 VM that
  already runs Caddy, frps, frp-gate and a game server, or on a shared Raspberry Pi 5 (arm64).
  Target: **< 64 MB RSS idle, < 128 MB while plans run** (see [Runtime](#runtime-and-resources)).
- **Rebuildable from git.** Packages, adapters and saved plans come from a YAML file, applied at
  start like frp-gate's declarative config. Losing the database loses history, not setup: the
  current state is observed again from the platforms.
- **No automatic rollback.** `npm publish` is effectively irreversible; a failed plan stops and can
  be resumed, it is never undone.
- **Not built:** dependency-update bots (Renovate and the like are out of scope), a hosted/SaaS
  version, multi-user roles in the first versions.

## Domain model

```
Project ─┬─ Repo ─── Package ─── Release (tag) ─── Build (CI run) ─── Artifact ─── Deployment
         │                │
         │                └── chain: which stages this package has, and its last stage
         └── shared defaults (release trigger, tag pattern, CI)
```

| Object | What it is | Identity |
| --- | --- | --- |
| Project | A group of repos with shared defaults (e.g. this monorepo). | name |
| Repo | A git repository on some host. | URL |
| Package | Something released on its own: an npm library, an image, a static site. | project + name |
| Release | A tag that names a version of a package (`js-utils-v4.1.0`). | package + version |
| Build | The CI run started by that tag. Status from the CI API. | package + version (+ run id) |
| Artifact | The published output: npm version, OCI image tag (+ digest). | package + version |
| Deployment | A runtime target that runs some version of the package. | package + target |

**The join key is package name + version.** Every adapter maps its own data to it: the tag pattern
parses `js-utils-v4.1.0` into (`js-utils`, `4.1.0`); a GitHub Actions run for a tag push carries the
tag in `head_branch`; the npm registry lists versions; an OCI registry lists tags; a runtime reports
the image tag or a version endpoint; a CDEvent carries a purl (`pkg:npm/%40telperion/js-utils@4.1.0`).
Package names inside Beacon are short ids (`js-utils`); the coordinates on each platform
(`@telperion/js-utils`, `ghcr.io/telperiontech/frp-gate`) are per-adapter settings.

### Chains and stages

Each package declares its own chain. Stages are ordered and optional, except the first:

```
tagged ──► built ──► published ──► deployed
(source)   (CI)      (artifact)    (runtime, per target)
```

- The chain **ends at its last configured stage**. An npm library ends at `published`. A service
  ends at `deployed` ("running version = new version" on every configured target). A static site
  deployed straight from CI may have no artifact stage and end at `built` or at `deployed` via an
  http-check.
- A stage with no adapter is skipped, not shown as missing.
- Per version and stage, Beacon stores one state: `missing`, `pending` (started, e.g. CI queued or
  running), `ok`, `failed`, plus when it was first seen in that state.
- A **gap** is a version whose stage *n* is `ok` and stage *n+1* is `missing` or `failed`. Its age is
  "now − time stage *n* became ok". Thresholds per stage decide when a gap is shown as stuck (e.g. a
  build normally starts within 2 minutes of a tag; an image tagged 3 days ago and not deployed is
  stuck).
- Deployment is per target: a package deployed to two Coolify servers has two deployment rows, and
  its `deployed` stage is `ok` only when every required target runs the version.
- "Unreleased changes" (commits touching the package's folder since its last tag) is an extra,
  optional column before `tagged`, available where the source adapter can compare refs (GitHub).
  It is what makes a "release" button meaningful, but it is not part of the chain.

## Components

```
apps/beacon/
  cmd/beacon          wiring, two listeners, scheduler start; CLI: apply, export, backup, healthcheck
  internal/model      package, version, stage, chain, gap: pure types and rules
  internal/semver     parse, compare, bump (major/minor/patch, later prerelease)
  internal/observe    poll scheduler: next-poll heap, backoff, rate-limit budget per platform
  internal/adapter/   one folder per layer; one sub-package per implementation
    source/ trigger/ ci/ artifact/ runtime/
  internal/ingest     inbound GitHub webhooks and CDEvents → observations
  internal/plan       DAG validation, step state machine, locks, concurrency limits, preview
  internal/action     one-click actions (built on plan: an action is a one-step plan)
  internal/declare    the YAML config: parse, validate, apply (one transaction), export
  internal/secret     *_env / *_file / GitHub App token minting; nothing secret leaves this package
  internal/api        JSON API + SSE stream, shared Service (UI and API use the same code)
  internal/auth       admin login, session cookies, CSRF (like frp-gate)
  internal/audit      who did what (ui | api | apply | plan), carried in the context
  internal/store      SQLite (modernc.org/sqlite, no cgo), migrations by user_version
  internal/web        go:embed of the built UI
  ui/                 Angular app (Nx project beacon-ui), built into internal/web/dist
```

Like frp-gate, two listeners keep trust boundaries apart:

- **:7700, ingest.** `/hooks/github` (App webhooks, HMAC-checked), `/cdevents` (bearer token per
  source), `/healthz`, `/metrics`. This is the only part that may be reachable from the internet,
  and only if push events are wanted; polling works without it.
- **:7701, admin.** UI, JSON API, SSE. Password-protected, meant to sit behind Caddy.

### Observation loop

All platform state enters through one path: an adapter returns observations ("`js-utils` `4.1.0`:
artifact `ok` at t"), `observe` writes them to the store, and the store emits a change event that the
SSE stream, the gap rules and the plan runner react to. Polling, GitHub webhooks and CDEvents are
three producers of the same observations, so a push event only makes things faster; missing one never
leaves Beacon wrong for longer than one poll interval.

Polling is adaptive per (adapter, package):

- **hot** (a step of a running plan waits on it, or a stage is `pending`): every 15 s
- **warm** (a change seen in the last 30 min): every 2 min
- **cold**: every 15 min (configurable; with webhooks set up, cold can be hours)
- errors back off exponentially with jitter, up to the cold interval
- conditional requests (`ETag` / `If-None-Match`) wherever the API offers them; GitHub does not count
  `304` answers against the rate limit. A per-platform budget reads `X-RateLimit-Remaining` and
  stretches intervals before the limit is hit.

One goroutine owns the schedule (a min-heap of next poll times) and a small worker pool (default 4)
performs requests, so the number of goroutines and open connections does not grow with the number of
packages.

## Data model

SQLite tables (one file in `/data`):

- **Config (managed by the YAML, like frp-gate):** `projects`, `repos`, `packages`,
  `package_stages` (adapter + settings per stage), `targets` (runtime targets with concurrency
  limits), `recipes` (saved plans). Rows from the file are `managed`; rows made in the UI (later
  phase) are not, and apply never touches them.
- **Observations:** `versions` (package, version, first seen), `stage_states` (package, version,
  stage, target, state, since, url, detail). Only the latest state per key is kept;
  transitions go to `events`.
- **Events:** append-only log of transitions and inbound pushes, pruned to the newest 50,000 rows or
  90 days. It feeds the timeline view.
- **Plans:** `plan_runs`, `plan_steps` (state, needs, target stage, trigger intent, timestamps),
  `locks` (leases, so a restart knows what was held).
- **Audit:** `audit_log`, as in frp-gate (time, source, actor, action, object, detail with no
  secret).
- **Settings:** session signing key, schema version.

One connection in WAL mode (`SetMaxOpenConns(1)`), `BEGIN IMMEDIATE`, `busy_timeout` 5 s, so the
CLI (`beacon apply`, `export`, `backup`) can run as a second process via `docker exec`, exactly like
frp-gate.

## Auth and secrets

- **GitHub access is a GitHub App, not a personal token.** It is what makes Beacon adoptable by
  others: installed per org or repo, fine-grained permissions, short-lived installation tokens, and
  actions show up as the App, not as a person. Permissions: Metadata read, Contents read/write
  (create tags and releases, commit dependency bumps), Actions read/write (run status,
  `workflow_dispatch`, re-run), Pull requests read/write (dependency bumps by PR), Packages read
  (private ghcr images). Events: `push`, `create`, `release`, `workflow_run`, `registry_package`,
  `pull_request`. The private key is mounted as a file (`BEACON_GITHUB_APP_KEY_FILE`); installation
  tokens are minted per installation, kept in memory only, and refreshed before their 1 h expiry.
  A read-only setup (Phase 1) needs only read permissions; the docs will offer both App manifests.
- **Tags created with an App installation token trigger `push: tags` workflows.** Only the
  workflow-scoped `GITHUB_TOKEN` is blocked from triggering workflows. This is what lets Beacon start
  the existing `*.publish.yml` workflows unchanged (see
  [design/plans.md](design/plans.md#release-mechanism-for-this-repo)). To be verified in Phase 0.
- **Every other secret stays server-side**: Coolify tokens, registry credentials, webhook secrets,
  CDEvents source tokens. In the YAML they are referenced, never written: `token_env`, `token_file`
  (same convention as frp-gate). The API never returns a secret, the UI never receives one, logs mask
  them. Inbound tokens (CDEvents sources) are stored as SHA-256 hashes.
- **Panel login** starts as one admin password (`BEACON_ADMIN_PASSWORD[_FILE]`), HMAC-signed session
  cookies (`HttpOnly`, `SameSite=Strict`, `Secure`), Go's `http.CrossOriginProtection` for CSRF, 1 s
  delay on a failed login: the frp-gate model. A later phase adds "Sign in with GitHub" through the
  same App with an allow-list of logins, so the audit log names a person.
- **Blast radius.** Beacon can push tags and commits to every repo the App is installed on, and
  deploy to every configured runtime. So: install the App only on the repos Beacon manages; keep the
  admin listener behind Caddy (optionally with forward auth); every write goes through the preview
  screen and the audit log; outbound URLs (webhook triggers, http-checks) come only from the YAML in
  the MVP, not from the UI, so the UI cannot be used for SSRF.

## Runtime and resources

Hard requirement: a 1 GB amd64 VM shared with Caddy, frps, frp-gate and a game server, or a
Raspberry Pi 5 (arm64, 8 GB) shared with many services.

- **Memory target: < 64 MB RSS idle, < 128 MB with plans running.** The image sets
  `GOMEMLIMIT=48MiB` by default (overridable); SQLite `cache_size` is limited to 2 MB. Measured in
  Phase 1 with the full telperion catalog (~30 packages) and kept as a CI check (start the image,
  poll for 5 minutes against recorded fixtures, assert RSS).
- **Large registry documents are streamed.** An npm packument for a long-lived package is several
  MB; the npm adapter decodes it with a streaming JSON decoder and keeps only `versions` keys and
  `time`. OCI tag lists are paginated.
- **No background work without a reason.** Cold polling is slow; the scheduler sleeps between
  polls. No in-memory cache of history: the UI pages events from SQLite.
- **Single binary, distroless.** `Dockerfile`: `ui` (Node, on `$BUILDPLATFORM`, builds the Angular
  app once: its output is the same for every architecture) → `src` → `test` (`go vet`, `go test`) →
  `build` (cross-compiled, `CGO_ENABLED=0`) → `runtime` (`distroless/static-debian12:nonroot`).
  Multi-arch amd64 + arm64, no QEMU. Data in a `/data` volume. `HEALTHCHECK` runs
  `beacon healthcheck`. Expected image size: about 30 MB.

### Why Go

- frp-gate is the precedent: same packaging, same SQLite driver, same admin model. Patterns (and
  maybe code, see [Telperion libraries](#telperion-libraries)) carry over.
- A Go service like this idles at 10–20 MB RSS; Node.js starts at 40–60 MB before any work, which
  leaves no room under 64 MB. Rust would be smaller still, but adds a second systems toolchain to the
  repo for a gain this workload does not need.
- Pure-Go SQLite (`modernc.org/sqlite`) means a static binary and cross-compiling for arm64 without
  emulation.
- The work is I/O-bound polling and HTTP: goroutines and `net/http` fit it without a framework.

### UI: Angular with the owner's libraries

The UI is an Angular app (Nx project `beacon-ui` in `apps/beacon/ui`), built to static files and
embedded with `go:embed`. Static files cost image size, not server memory: Go serves them from the
binary's read-only data with precompressed (`.br`/`.gz`) variants and immutable caching for hashed
file names.

- Zoneless, signals throughout, declarative and reactive: views derive from server state, never
  push state around by hand.
- `@telperion/ng-pack`: `sse-client` for the live event stream (one SSE connection, `/api/events`),
  `fetcherSignal` for API reads, `storage-signals` for UI preferences (filters, collapsed groups).
- `@telperion/ng-ui`: form fields (`<tui-field>`) for the template-driven forms (plan builder, bump
  dialog, login).
- Template-driven forms only; the class receives submitted values as a stream and derives state.
- **Bundle budget: 250 KB gzipped initial**, enforced in `project.json` budgets. Routes for plans and
  settings are lazy.
- The DAG view is a small SVG component with a layered layout (longest-path layers, steps sorted in
  a layer by name). No graph library.

Why not server-rendered `html/template` as in frp-gate: frp-gate's UI is CRUD forms. Beacon's main
screens are live (stage changes stream in, plan steps move) and its plan builder and preview are
interactive. Done with templates, that would need htmx plus hand-written JS, i.e. an untyped second
frontend. Angular keeps that code typed, reuses the owner's libraries, and costs only a Node stage in
the image build.

## Telperion libraries

Code that could live in a Telperion library, to decide when it is written (nothing is moved now):

- **A first Go library, e.g. `libs/go-kit`.** frp-gate and Beacon would share: admin password login
  with signed session cookies, SQLite open + migrations by `user_version`, `*_FILE` environment
  loading, hand-written Prometheus text metrics, the `healthcheck` subcommand, the audit-actor
  context. Today that would be copied from frp-gate; with two consumers it is worth a module.
- **Go platform clients** (GitHub App token minting, npm registry, OCI distribution, Coolify API):
  generic and reusable, but start inside Beacon (`internal/adapter/...`) and move to a Go library
  only when a second consumer appears.
- **`@telperion/ng-ui`**: the DAG view and the stage pipeline ("tagged → built → published →
  deployed" with states) are generic display components.
- **CDEvents/purl types** for TypeScript, if another TS project ever emits or consumes CDEvents
  (Beacon's UI does not need them; the server parses them).

## Open source

- **License: Apache-2.0**, like frp-gate (decided). Permissive, with a patent grant. The trade-off
  that was considered: AGPL-3.0 would force anyone offering a hosted Beacon to publish their changes
  and would protect a possible hosted version; it also keeps some companies from adopting it.
  Apache-2.0 favours adoption by self-hosters and small teams, the intended audience.
- **Generalization.** The required base is git + CI + tag-based releases. The minimal setup is the
  generic git source (`ls-remote` over smart HTTP, any host), a generic webhook trigger and CDEvents
  inbound; every GitHub, npm, OCI or Coolify feature is an optional adapter on top.
- **No personal infrastructure** in code, docs or examples: `example.com` hosts, placeholder names,
  as everywhere in this repo.

## Dev ports

From this repo's block (10500–10599, see `AGENTS.md`), next free in the apps range:

| Port | What |
| --- | --- |
| 10504 | `beacon-ui` dev server (proxies `/api` and SSE to 10505) |
| 10505 | Beacon admin listener in dev (`:7701` in the container) |
| 10506 | Beacon ingest listener in dev (`:7700` in the container) |
| 10531 | Beacon docs app (later phase, docs range) |

These are added to the owner's port registry (self-host repo, `docs/dev-ports.md`) and to the list in
`AGENTS.md` when the projects are created (Phase 0).

## Future ideas (not planned)

- A "who uses which version of this library" view, built from Beacon's own observations of dependent
  packages' manifests, not from a dependency bot.
- Emitting CDEvents (Beacon as a producer), notifications when a gap gets old.

## To verify before or while building

- An App installation token creating a tag (via the Git refs API and via the Releases API) starts a
  `push: tags` workflow. (Phase 0, on a throwaway package.)
- Coolify v4 API: reading an application's running image tag, setting it, triggering a deploy, and
  reading the deployment's status; which version Beacon targets first. (Phase 1)
- RSS of the idle binary with the full catalog, on arm64 and amd64. (Phase 1)
- GitHub Actions `branch` filter matching a tag name for tag-triggered runs. (Phase 1)
