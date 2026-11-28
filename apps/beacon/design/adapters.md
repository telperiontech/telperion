# Beacon adapters

Part of the [Beacon design](../DESIGN.md). Interfaces are general; implementations are few. The MVP
ships the set in [MVP adapters](#mvp-adapters) and nothing else.

## Principles

- **One layer, one interface.** Source, trigger, CI, artifact, runtime. A package binds one adapter
  per stage it has (deployments: one per target).
- **APIs, not logs.** Status comes from the platform's API. Logs are fetched only to show them, never
  parsed to decide a state.
- **Observations out, nothing else.** An adapter returns observations keyed by package + version; it
  does not write to the store or know about plans.
- **Idempotent writes.** Every write (create a tag, dispatch a workflow, deploy) is preceded by a read
  that checks whether the result already exists, so a retried or resumed step adopts earlier work
  instead of doing it twice.
- **Small dependency surface.** Plain `net/http` + `encoding/json` per platform; no vendor SDKs
  (the GitHub and Kubernetes SDKs alone would outweigh the rest of Beacon).

## Interfaces

Sketched in Go. `Ref` is the package's identity and its per-adapter settings; `Obs` is an observation
(version, stage, target, state, time, URL, short detail).

```go
// Source: which versions exist (tags), optionally what changed since the last one.
type Source interface {
    Tags(ctx context.Context, repo Repo) ([]Tag, error)                 // name + commit SHA
    Head(ctx context.Context, repo Repo, branch string) (string, error) // SHA
}
type ChangeLister interface { // optional capability
    ChangedSince(ctx context.Context, repo Repo, tag, branch string, path string) (int, error)
}

// Trigger: start a release (or a deploy-like action) and say how to recognise its result.
type Trigger interface {
    Plan(ctx context.Context, req ReleaseRequest) (TriggerPlan, error) // dry run: what would happen
    Fire(ctx context.Context, p TriggerPlan) (TriggerRef, error)       // idempotent: adopts existing tag/run
}

// CI: the run a release started.
type CI interface {
    Runs(ctx context.Context, pkg Ref, versions []string) ([]Obs, error)
    LogURL(ctx context.Context, run RunRef) (string, error) // display only
}
type Rerunner interface { Rerun(ctx context.Context, run RunRef) error } // optional

// Artifact: is version X published, and what exactly (digest, platforms).
type Artifact interface {
    Versions(ctx context.Context, pkg Ref) ([]Obs, error)
}

// Runtime: which version runs on a target, and (optionally) deploy a version.
type Runtime interface {
    Running(ctx context.Context, t Target, pkg Ref) (Obs, error)
}
type Deployer interface {
    Deploy(ctx context.Context, t Target, pkg Ref, version string) (DeployRef, error)
    DeployStatus(ctx context.Context, d DeployRef) (Obs, error)
}
```

Optional capabilities are separate interfaces, checked with a type assertion; the UI shows an action
only when the bound adapter has it (no "deploy" button on an http-check target).

## Layers

### Source

| Adapter | How | Notes |
| --- | --- | --- |
| `git` (MVP) | `GET <repo>/info/refs?service=git-upload-pack` (smart HTTP ref advertisement, what `git ls-remote --tags` reads) | Any host. Pure Go, no git binary, no clone. Optional basic auth/token for private repos. |
| `github` (MVP, with the App) | Git refs and compare APIs | Adds "unreleased changes" (`ChangedSince`) and webhook-driven updates. |
| `gitlab`, `gitea` | Their tags and compare APIs | Later. Until then the `git` adapter covers them read-only. |

The tag pattern (`{package}-v{version}` by default) maps tags to package + version. Tags that do not
match any package are ignored.

### Release trigger

| Adapter | How | Notes |
| --- | --- | --- |
| `github-release` (MVP) | Create a release with a new tag at a given commit (Releases API, `generate_release_notes`); or only the tag (Git refs API) | The `gh release create` equivalent. The tag push starts the existing `*.publish.yml`. Default for this repo. |
| `github-dispatch` (MVP) | `workflow_dispatch` with inputs (e.g. `package`, `version`, `bump`) | For repos whose release is a workflow. A dispatch returns no run id: Beacon finds the run by workflow + `created` time + inputs echoed in `run-name`. |
| `webhook` (MVP) | `POST` a JSON body (`package`, `version`, `bump`, `tag`, `plan`) to a configured URL, HMAC-signed (`X-Beacon-Signature-256`) | Any system. Its result is observed through the other adapters or reported back by CDEvents. |
| `gitlab-pipeline`, `jenkins` | Trigger a pipeline / build with parameters | Later. |
| `git-tag` | Push a tag over git smart HTTP/SSH | Later: the fully generic path for non-GitHub hosts. |

Version computation (next version from the latest tag and a bump) happens in Beacon
(`internal/semver`), not in the trigger. A trigger receives the exact version and tag.

### Build / CI status

| Adapter | How | Notes |
| --- | --- | --- |
| `github-actions` (MVP) | List workflow runs of the package's publish workflow, `event=push`, `branch=<tag>`; `status` + `conclusion` | Re-run failed jobs (`Rerunner`). Logs only as a link (or fetched for display). `workflow_run` webhooks make it instant. |
| `gitlab-ci`, `jenkins`, `gitea-actions` | Pipelines / builds by ref | Later. |
| none | | Allowed: a package whose CI is not observable goes from `tagged` to `published` directly, or reports `built` by CDEvents. |

### Artifact

| Adapter | How | Covers |
| --- | --- | --- |
| `npm` (MVP) | Registry API `GET /<name>` (packument; streamed, only `versions` and `time` kept), `ETag` | npmjs.org, Verdaccio, GitHub Packages, any npm-compatible registry (base URL + optional token). |
| `oci` (MVP) | Distribution API: `GET /v2/<name>/tags/list` (paginated), `HEAD /v2/<name>/manifests/<tag>` for the digest; the index for platforms; bearer token flow from `WWW-Authenticate` | ghcr.io, Docker Hub, Harbor, any distribution-spec registry. Reports "only amd64" when an expected platform is missing. ECR (AWS signing) later. |

### Runtime

| Adapter | How | Notes |
| --- | --- | --- |
| `coolify` (MVP) | Coolify v4 API: application details (running image tag), set image tag + deploy, deployment status | `Runtime` + `Deployer`. Per target (one Coolify instance = one target) a concurrency limit, default 1: a small server should build or pull one thing at a time. Endpoints to verify against the chosen Coolify version (see [DESIGN](../DESIGN.md#to-verify-before-or-while-building)). |
| `http-check` (MVP) | `GET` a URL; the version comes from a JSON pointer (`/version`), a header, or a regex on the body; 2xx = healthy | `Runtime` only. Covers anything that exposes its version: static sites (`/version.json`), services behind any orchestrator, the owner's Ansible-deployed compose stacks. |
| `dokploy`, `portainer`, `kubernetes` | Their APIs (Kubernetes: Deployment image tag + rollout status) | Later. |

Deploying to a compose stack managed from git (image tag in a compose file, applied by Ansible) is not
a runtime adapter: it is an `update-deps` step that bumps the tag in that repo's file, observed by an
http-check (see [plans.md](plans.md#step-types)).

## Inbound: webhooks and CDEvents

Polling is the baseline. Push paths make Beacon faster and let systems without an adapter report.

### GitHub App webhooks

`POST /hooks/github` on the ingest listener, `X-Hub-Signature-256` checked with the App's webhook
secret. `push`/`create` (tags), `workflow_run`, `release`, `registry_package`, `pull_request` are
turned into observations or into "poll this now" hints. Unknown events are acknowledged and dropped.

### CDEvents

[CDEvents](https://cdevents.dev) is the CD Foundation's vocabulary for delivery events, carried as
CloudEvents. `POST /cdevents` accepts structured (`application/cloudevents+json`) and binary
CloudEvents. Each source has its own bearer token (referenced in the YAML, never stored); a source may be
limited to some packages.

| CDEvent type | Becomes |
| --- | --- |
| `dev.cdevents.change.merged`, `...branch...` | ignored (out of the chain) |
| `dev.cdevents.build.started` / `.finished` | `built` stage `pending` / `ok` or `failed` |
| `dev.cdevents.artifact.packaged`, `.published` | `published` stage `ok` (packaged = `pending`) |
| `dev.cdevents.service.deployed`, `.upgraded` | `deployed` `ok` for the event's environment (= target) |
| `dev.cdevents.service.rolledback`, `.removed` | `deployed` state updated to the version now running / `missing` |
| `dev.cdevents.pipelinerun.*` | `built` stage, when no build events are sent |

The join key comes from the artifact id, which CDEvents gives as a
[purl](https://github.com/package-url/purl-spec): `pkg:npm/%40telperion/js-utils@4.1.0`,
`pkg:oci/frp-gate@sha256:...?repository_url=ghcr.io/telperiontech&tag=1.2.2`. Beacon maps
(type, name) to a package through the artifact coordinates in the config, and the version from the
purl version or `tag` qualifier. Events that map to no package are logged in the event list as
"unmatched" (so a misconfigured source is visible) and otherwise dropped.

Pushed observations are trusted as much as polled ones, but a poll that disagrees wins on its next
run for adapters that can be polled: a CDEvent cannot mark an npm version published that the
registry does not have.

## MVP adapters

| Layer | MVP | Later |
| --- | --- | --- |
| Source | `git`, `github` | `gitlab`, `gitea` |
| Trigger | `github-release`, `github-dispatch`, `webhook` | `gitlab-pipeline`, `jenkins`, `git-tag` |
| CI | `github-actions` | `gitlab-ci`, `jenkins`, `gitea-actions` |
| Artifact | `npm`, `oci` | ECR, PyPI, Maven, ... |
| Runtime | `coolify`, `http-check` | `dokploy`, `portainer`, `kubernetes` |
| Inbound | GitHub webhooks, CDEvents | GitLab/Gitea webhooks |
