# Beacon configuration

Part of the [Beacon design](../DESIGN.md).

## The YAML file

One file (`BEACON_CONFIG`, e.g. `/config/beacon.yaml`) binds packages to adapters. It is applied at
start and on demand (`beacon apply [--dry-run]`), with the rules frp-gate's declarative config
established: strict parsing (unknown keys are errors), full validation before any change, one
transaction, `managed` rows, an invalid file stops the start, `beacon export` writes the current
state back as YAML. Secrets are never in the file, only references (`token_env`, `token_file`).

```yaml
github:
  app_id: 123456
  private_key_file: /run/secrets/beacon-github-app.pem
  webhook_secret_env: BEACON_GITHUB_WEBHOOK_SECRET

targets:
  coolify-main:
    coolify: { url: https://coolify.example.com, token_env: COOLIFY_TOKEN }
    limit: 1                       # one deploy at a time on this server

cdevents:
  sources:
    - name: home-ci
      token_env: BEACON_CDEVENTS_HOME_CI
      packages: [docs-site]        # optional: what this source may report on

projects:
  - name: telperion
    repo: telperiontech/telperion  # GitHub shorthand; or git: https://git.example.com/x/y.git
    catalog: nx                    # discover packages, see below
    tag: "{package}-v{version}"    # default
    release: { github-release: { notes: generate } }
    ci: { github-actions: { workflow: "{package}.publish.yml" } }
    packages:
      js-utils: { artifact: { npm: "@telperion/js-utils" } }
      ng-pack:  { artifact: { npm: "@telperion/ng-pack" } }
      frp-gate:
        artifact: { oci: ghcr.io/telperiontech/frp-gate }
        deploy:
          - coolify-main: { app: "<coolify app uuid>" }
          - http-check: { url: https://gate.example.com/healthz, version: { header: X-Version } }

  - name: elsewhere                # any git host, no GitHub features
    repo: { git: https://git.example.com/acme/site.git }
    release: { webhook: { url: https://ci.example.com/hooks/release, secret_env: SITE_HOOK_SECRET } }
    packages:
      docs-site:
        deploy:
          - http-check: { url: https://docs.example.com/version.json, version: { json: /version } }

recipes:
  - name: utils-wave
    steps: { ... }                 # see plans.md
```

- **Defaults cascade**: project → package. A package states only what differs (usually its artifact
  coordinate and deploy targets).
- **Chain = configured stages.** `js-utils` has source, CI and artifact, so it ends at `published`.
  `frp-gate` adds deploy targets, so it ends at `deployed`. `docs-site` has no CI or artifact adapter,
  so its chain is `tagged → deployed`. A stage that is only pushed by CDEvents is bound with
  `ci: cdevents` or `deploy: [{ cdevents: { environment: staging } }]`.
- **As built in Phase 2**, a package also has `branch` (releases tag its head; default the repo's
  default branch, read from the ref advertisement) and `path` (its folder; unreleased changes count
  only commits that touch it), and `release: none` turns a project's trigger off for one package.
  CDEvents sources are a list (`cdevents.sources`), each with its own `token_env`/`token_file`.
- **As built in Phase 3**, a recipe is `{ name, fail-fast, steps }`; each step has exactly one of
  `release: <package>` (with `bump` or `version`, `until`, `batch: false`), `update-deps: { package,
  deps, via }` (`via` is `commit` by default) and `deploy: <package>` (with `target`, optional
  `version`), plus `needs`. Steps are keyed by name, so their order in the file does not matter.
  Recipes saved in the UI are kept next to the file's (unmanaged); `apply` leaves them alone unless
  the file has a recipe of the same name, which replaces it. `export` writes both.
- **Validation** checks every reference (targets, packages in recipes and CDEvents sources), tag
  patterns that would match the same tag for two packages, recipes with cycles.

## Catalog discovery from Nx

`catalog: nx` fills the package list of a project so the file does not have to repeat it. Beacon runs
in a distroless image with no Node, so it cannot run `nx show projects --json`. Instead it reads the
repo through the source adapter (GitHub tree and contents APIs, cached by commit SHA):

1. every `project.json` gives a project name and root;
2. every `.github/workflows/*.publish.yml` with an `on.push.tags` pattern like
   `'js-utils-v[0-9]+.[0-9]+.[0-9]+'` gives a tag prefix, and so a releasable package with a CI
   workflow;
3. a package found in both is offered; its artifact is guessed from the workflow (`npm publish` →
   npm with the name from its `package.json`; `docker/build-push-action` with an image name → oci) and
   shown as a suggestion until the YAML confirms it.

Explicit `packages:` entries always win over discovery. Projects without a publish workflow are not
releasable and are listed separately. Projects that Nx infers from plugins with no `project.json` are
not found this way; for those an optional CI step can run `nx show projects --json` and commit a
`beacon.catalog.json`, which Beacon reads instead (a later option, not MVP).

## Later: editing in the UI

A later phase lets the UI create and edit packages, targets and recipes as unmanaged rows, next to
the managed ones from the file, with the frp-gate rules (the UI refuses edits of managed rows;
`export` turns UI rows into YAML to commit). Until then the file is the only way to configure Beacon,
and the UI only reads it.
