# Beacon roadmap

Phases for the [Beacon design](DESIGN.md). Phases 1–3 are the MVP: seeing the gaps, single actions,
chained plans. Each phase ends with a tagged image (`beacon-vX.Y.Z` → `ghcr.io/telperiontech/beacon`)
that runs in the owner's setup before the next phase starts.

## Phase 0: groundwork

- `apps/beacon`: `go.mod`, `cmd/beacon` (healthcheck only), `Dockerfile` (ui → src → test → build →
  distroless runtime, amd64 + arm64), `project.json` (`build`, `test`, `run`), `LICENSE`
  (Apache-2.0), README.
- `apps/beacon/ui`: Angular app `beacon-ui` (zoneless, `@telperion/ng-pack`, `@telperion/ng-ui`),
  bundle budget 250 KB gzipped, dev server on 10504.
- `beacon.publish.yml`: tag `beacon-vX.Y.Z`, hadolint + tests, multi-arch push, like
  `frp-gate.publish.yml`.
- Ports 10504–10506 (and 10531 for the later docs app) in `AGENTS.md` and in the owner's port
  registry.
- **Check:** a tag created by a GitHub App installation token (Releases API and Git refs API) starts a
  `push: tags` workflow, on a throwaway package. The release mechanism depends on it.
- Decided: `libs/go-kit` is started with Phase 1 (Beacon uses it; frp-gate switches over in its own change).

## Phase 1 (0.1): the overview, read-only

- YAML config: parse, validate, apply at start, `beacon apply --dry-run`, `export`, `backup`.
- SQLite store and migrations; observation loop with adaptive polling, backoff and rate-limit budget.
- Adapters, read side: `git`, `github` (App with read-only permissions), `github-actions`, `npm`,
  `oci`, `coolify` (running version), `http-check`.
- UI: package list with the chain per package, gaps first with their age, version timeline, links to
  CI runs and registries; live updates over SSE. Admin password login.
- `/healthz`, `/metrics`, audit log skeleton.
- **Measure:** idle RSS with the full telperion catalog on amd64 and arm64 (< 64 MB), and add the CI
  check for it.

Value: the gaps between tagged, built, published and deployed are visible for every package.

## Phase 2 (0.2): single actions

- GitHub App write permissions; `internal/secret` mints installation tokens.
- Triggers: `github-release` (default for this repo), `github-dispatch`, `webhook`.
- One-click actions: major/minor/patch release, deploy on Coolify, re-run failed build. Each as a
  one-step plan with preview, package/repo locks, target limits and audit.
- Inbound: GitHub App webhooks and CDEvents (`/cdevents`, per-source tokens, purl mapping).
- "Unreleased changes" column (GitHub compare).

Value: a release of this repo's packages is a button, and its progress to the registry is watched to
the end.

Built as: `internal/plan` (preview, start, the step state machine, locks and limits; an action is a
one-step run, so no separate `internal/action`), `internal/bind` (one adapter set and GitHub App per
catalog, shared by polling and plans), `internal/ingest` (webhooks, CDEvents). Write tokens are
minted per action and limited to the one repo. Config: `release:`, `branch`, `path` (for unreleased
changes), `github.webhook_secret_*`, `cdevents.sources`, and `ci: cdevents` / `deploy: - cdevents:`
for stages that are only reported. Left open: CDEvents `pipelinerun.*` and `service.removed` are
recorded as unmatched; a `github-dispatch` run is followed through its tag, not identified by id;
the Coolify deploy endpoints are unverified against a live instance.

## Phase 3 (0.3 → 1.0): release plans

- DAG plans: recipes in YAML, ad-hoc plans in the UI (template-driven plan builder), saving an ad-hoc
  plan as a recipe, export to YAML.
- Step types `release`, `update-deps` (`via: commit` and `via: pr`, PR pause), `deploy`.
- Same-repo batching, locks as SQLite leases, per-target concurrency limits.
- Failure handling: skip dependents, continue independent branches, optional fail-fast, resume,
  restart safety via stored trigger intents. DAG view in the UI.
- Preview screen with every version change, majors confirmed separately.

1.0 when the owner's real chains (utility libraries → ng-pack/ng-ui → services → deploys) run through
Beacon.

## Phase 4: setup comfort

- `catalog: nx` discovery (project.json + publish workflow tag patterns), artifact suggestions.
- UI editing of packages, targets and recipes as unmanaged rows (frp-gate's managed/unmanaged rules).
- "Sign in with GitHub" through the App with an allow-list; the audit log names a person.
- Docs app (`open-source.telperion.tr/beacon`, dev port 10531), example compose file with Caddy.

## Phase 5: more platforms

- Source/CI/trigger: GitLab, Gitea, Jenkins, `git-tag` push for non-GitHub hosts.
- Runtime: Dokploy, Portainer, Kubernetes.
- Artifact: ECR and other registries as asked for.
- Outbound CDEvents (Beacon as a producer); notifications when a gap gets old.

## Later ideas

- A "who uses which version of this library" view from Beacon's own observations of dependents'
  manifests (no dependency bot).
