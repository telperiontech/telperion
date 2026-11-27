# Beacon actions and release plans

Part of the [Beacon design](../DESIGN.md).

## One-click actions

Ready-made actions next to each package, shown only when the bound adapters support them:

- **Release**: `major` / `minor` / `patch` buttons. Beacon takes the latest tag of the package,
  computes the next version, and opens the preview ("js-utils 4.1.0 → 4.2.0, tag `js-utils-v4.2.0`
  on `main` at `6b3d6d8`, 3 unreleased commits"). A `major` is highlighted and needs an extra tick.
- **Deploy**: "deploy 1.2.2 on coolify-main" for a service whose image for that version is
  published and whose target runs an older one. Shown on the gap, where it is needed.
- **Re-run failed build**: for a `failed` build stage, where the CI adapter can re-run.

**An action is a one-step plan.** It goes through the same preview, locks, limits, audit and step
state machine as a chained plan, so there is one code path for every write.

## Release plans

A plan is a set of steps with GitHub-Actions-like `needs:`, i.e. a DAG. Several plans can run at
once, and steps inside a plan run in parallel when their `needs` are done.

```yaml
recipes:
  - name: utils-wave
    steps:
      extra-ts-types: { release: extra-ts-types, bump: minor }
      js-utils:       { release: js-utils, bump: minor, needs: [extra-ts-types] }
      rx-utils:       { release: rx-utils, bump: patch, needs: [extra-ts-types] }
      ng-pack-deps:
        update-deps: { package: ng-pack, deps: [js-utils, rx-utils], via: commit }
        needs: [js-utils, rx-utils]
      ng-pack:        { release: ng-pack, bump: minor, needs: [ng-pack-deps] }
      frp-gate:       { release: frp-gate, bump: patch, until: published }
      frp-gate-live:  { deploy: frp-gate, target: coolify-main, needs: [frp-gate] }
```

**Saved plans ("recipes") and ad-hoc plans from the UI are the same data structure.** A recipe from
the YAML is `managed`; an ad-hoc plan can be saved as an unmanaged recipe, or exported as YAML to put
in the file. A plan run is a copy of the recipe at start time, so editing a recipe never changes a
running plan.

### Step types

| Type | Does | Done when |
| --- | --- | --- |
| `release` | Fires the package's trigger with the computed version (`bump`, or an exact `version`). | The package's chain reaches its final stage for that version, or the stage named in `until` (`tagged`, `built`, `published`, `deployed`). |
| `update-deps` | In another package's manifest, sets the range of each listed dependency to `^<version>` (the version that dependency reached in this plan, or its latest published one if it is not in the plan). `via: commit` pushes to the default branch; `via: pr` opens a PR. A generic form edits a version string in any file (a YAML path or a regex), e.g. an image tag in a compose file in another repo. | The commit is on the branch. For `via: pr`: the PR is merged; **the plan pauses** on that step until it is (closed without merge = failed). |
| `deploy` | Sets the version on a runtime target that has a `Deployer`. | The target reports the version running. |

`update-deps` reading the version a `release` step produced is not data passing between steps: it is
a fixed, typed reference to a package, resolved by Beacon from observed state (package + version),
the same join key as everywhere else. Steps never receive arbitrary outputs from other steps.

### Rules

- **A step is done when the chain says so, not when it was triggered.** Triggering only moves a step
  to `running`; observations move it to `done` or `failed`.
- **Step states:** `waiting` (needs not done) → `ready` → `blocked` (lock or concurrency limit) →
  `triggering` → `running` → `done` | `failed`; `skipped` (a dependency failed), `paused` (waiting
  for a PR merge), `cancelled`.
- **Same-repo batching.** `release` steps in one repo that become ready together are fired as one
  release run when the trigger supports it: one repo lock, one target commit, all tags created on
  that commit; for `github-dispatch` one dispatch with a list of packages. A step can opt out with
  `batch: false`. Each step is still tracked and finished on its own.
- **Target commit.** A `release` step tags the branch head as read when the step fires, under the
  repo lock. So a release that `needs` an `update-deps` commit always includes it.
- **Locks.** A *package lock* allows one active step per package across all plans (two plans cannot
  release `js-utils` at once). A *repo lock* serializes writes to one repo (tag creation, commits,
  PR merge handling); it is held only for the write, not while CI runs. Locks are leases in SQLite,
  so a restart knows what was held.
- **Concurrency limits per target**: e.g. `coolify-main: 1` (one Coolify build at a time on a small
  server), `github-actions: 5`. A step over the limit is `blocked` and starts when a slot frees.
- **On failure:** dependents do not start (`skipped`); independent branches continue; running steps
  are not killed (Beacon never cancels a CI run or a deploy it started); optional `fail-fast: true`
  stops not-yet-started steps of the plan. The plan ends `failed` when nothing can run any more.
- **Resume from where it stopped.** Re-running a failed plan keeps `done` steps and retries failed
  and skipped ones. Before firing, every step checks observed state: if the tag for its version
  already exists, or the version is already published or running, it adopts that instead of firing
  again. The version of a retried release is the one computed at the first attempt (stored on the
  step), so a retry never skips a version.
- **No automatic rollback.** A published npm version cannot be taken back in practice; a deploy can
  be rolled back by hand with a `deploy` action to the older version.
- **Restart safety.** Plan state is in SQLite. Before firing, a step stores its trigger intent
  (version, tag, commit); after a restart, a step in `triggering` checks observed state first and
  only fires again if nothing happened. Running steps simply continue to be observed.

### Preview (dry run)

Every plan, including a one-click action, opens a preview before it starts:

- every version change (`4.1.0 → 4.2.0`), **majors highlighted** and confirmed separately;
- every tag and the commit it will point at; every dependency range change and whether it is a
  commit or a PR;
- every deploy and its target; expected waits on locks and concurrency limits;
- steps that will be adopted because their result already exists;
- validation errors: cycles, unknown packages, a `deploy` on a target without a deployer, a step whose
  package has no trigger.

The preview is computed by the same code that runs the plan (`Trigger.Plan` and the plan validator),
with no writes. Starting the plan re-checks it; if the state moved (a new tag appeared), the user
sees the new preview instead of a silent change.

## What plans are not

Beacon is a cockpit; GitHub Actions and the other CI systems are the engines. To keep it that way,
plans have **no conditions, no loops, no expressions, no data passing between steps, no arbitrary
scripts or HTTP calls**. Only the three step types above, ordered by `needs`. A requirement that
needs more belongs in a CI workflow that Beacon triggers (via `github-dispatch` or `webhook`) and
observes. This is also why Beacon is not a small n8n: it has no node library and no general
execution model, only a release chain per package.

## Release mechanism for this repo

Decided: **no Nx Release.** Releases are started from Beacon's UI, which fires the package's
configured trigger. For this repo that is `github-release`: the equivalent of
`gh release create js-utils-v4.2.0 --target <sha> --generate-notes`, done through the API with the
GitHub App's installation token.

- **Versions live in tags only**, as today. Source `package.json` files keep `0.0.0`; the publish
  targets fill in the version from the tag (`fill-package-json --packageVersion=$PACKAGE_VERSION`).
  Beacon computes the next version from the latest `{package}-v{version}` tag.
- **The existing `*.publish.yml` workflows stay unchanged.** A tag created with an App installation
  token starts `push: tags` workflows (only the workflow-scoped `GITHUB_TOKEN` cannot). So the
  `GITHUB_TOKEN` caveat does not apply, and no `release.yml` or `workflow_call` chain is needed.
  Verified in Phase 0 before anything depends on it.
- **npm trusted publishing** is unaffected: the publishing workflow is still the tag-triggered
  `*.publish.yml` that npm trusts (see `docs/NPM-TRUSTED-PUBLISHING.md`).
- **Dependency ranges between libraries** (e.g. `@telperion/ng-pack` → `@telperion/js-utils ^4.0.0`)
  are updated by `update-deps` steps in a plan, not by a release tool.
- `nx.json`'s `release.version.preVersionCommand` is then unused; whether to remove it is a separate
  cleanup.
- Same-repo batching creates several tags on one commit. Each tag starts its own publish workflow;
  they run in parallel and publish in any order. Plans that need an order (a library published before
  its dependent) say so with `needs`.
