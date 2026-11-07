# npm Trusted Publishing Migration

_Last updated: 2026-11-07_

## Why

npm is disabling granular access tokens, so token-based publishing from CI will stop working. The goal is to publish every package in this repo from GitHub Actions through trusted publishing (OIDC), with no `NPM_TOKEN` secret.

npm's trusted publishing changed several times in 2026. Keep the next section up to date as npm ships changes.

## What npm supports now

Monorepos work: each package trusts a repo and a workflow file. Since February 2026, one `npm trust` command can configure many packages at once.

| Change | Date | What it means here |
| --- | --- | --- |
| Validation fix after the trusted publishing flaw | Oct 2026 | Configs whose repo was never validated expire after 48 hours. Run `npm trust list` and confirm every repo is ours. |
| Multiple configs per package | Sep 2026 | One package can trust several workflows (reportedly up to 10), so tag-based and dispatch-based workflows can both publish. |
| Bulk setup with `npm trust` | Feb 2026 | Configure all packages from the CLI. Needs npm CLI 11.10.0 or later. |
| Trusted publishing baseline | 2025 | Needs npm CLI 11.5.1+ and Node 22.14+ in the runner, plus `permissions: id-token: write`. |

Not yet confirmed:

- Whether a brand-new package can be published for the first time through OIDC, or still needs one manual publish first.
- The exact `npm trust` flags. Check `npm help trust`.

## Current state of the repo

14 npm packages publish from 14 separate workflows in [.github/workflows/](../.github/workflows/), all using `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`. Each workflow runs `pnpm nx run <lib>:publish`, which ends in `npm publish --access public` from a build folder. No workflow sets `id-token: write` or pins an npm version.

| Package | Workflow | Trigger | setup-node | `repository` in source package.json |
| --- | --- | --- | --- | --- |
| @telperion/dom-utils | dom-utils.publish.yml | tag | v4 | telperiontech/telperion |
| @telperion/elements | elements.publish.yml | tag | v6 | telperiontech/telperion |
| @telperion/extra-ts-types | extra-ts-types.publish.yml | tag | v4 | telperiontech/telperion |
| @telperion/js-utils | js-utils.publish.yml | tag | v6 | telperiontech/telperion |
| @telperion/messenger | messenger.publish.yml | tag | v4 | telperiontech/telperion |
| @telperion/ng-pack | ng-pack.publish.yml | tag | v6 | missing |
| @telperion/ng-ui | ng-ui.publish.yml | tag | v6 | missing |
| @telperion/paintlet | paintlet.publish.yml | tag | v6 | telperiontech/telperion |
| @telperion/reactive-storage | reactive-storage.publish.yml | tag | v4 | missing |
| @telperion/rx-utils | rx-utils.publish.yml | tag | v4 | missing |
| @thalesrc/node-utils | node-utils.publish.yml | repository_dispatch | v4 | thalesrc/thalesrc (old repo) |
| @thalesrc/nx-utils | nx-utils.publish.yml | repository_dispatch | v4 | missing |
| @thalesrc/react-utils | react-utils.publish.yml | repository_dispatch | v4 | missing |
| @thalesrc/ts-utils | ts-utils.publish.yml | repository_dispatch | v4 | missing |

Not affected: `docker-frp`, `osw-home`, `osw-shell` and `auto-proxy` do not publish to npm.

## Migration steps

Keep one workflow per package, so each package trusts its own workflow file. Try the change on one package before touching the rest.

- [ ] Set `repository.url` to `https://github.com/telperiontech/telperion.git` in every published package.json (8 are missing it, and `node-utils` points at the old repo). Check that the `fill-package-json` step keeps it in the built output.
- [ ] In each workflow, add `permissions: { id-token: write, contents: read }` to the publish job.
- [ ] Move all workflows to `actions/setup-node@v6` with `node-version-file: 'package.json'`. Raise the root `engines.node` from `^22.13` to `^22.14`.
- [ ] Add a step `npm install -g npm@latest` before publishing, so npm is 11.10.0 or later.
- [ ] Locally, with npm 11.10+, run `npm trust` to point each package at repo `telperiontech/telperion` and its workflow file name.
- [ ] Pilot: remove `NODE_AUTH_TOKEN` from one workflow (for example `js-utils`), publish a patch, and confirm it shows provenance on npmjs.com.
- [ ] Roll out to the other 13 workflows.
- [ ] Run `npm trust list` and confirm every entry is our repo.
- [ ] In each package's npm settings, require trusted publishing and disallow tokens.
- [ ] Delete the `NPM_TOKEN` repo secret and revoke the token on npmjs.com.

## Open questions and risks

- When exactly does npm turn off granular tokens? Finish the pilot before that date.
- Do the 4 `repository_dispatch` workflows (`node-utils`, `nx-utils`, `react-utils`, `ts-utils`) work with OIDC as they are, or should they move to tag triggers like the others?
- Should the `@thalesrc/*` packages stay under that scope, or be republished as `@telperion/*`? Trust is set per package, so this changes the list.
- Can a new package's first publish use OIDC, or does it need one manual publish with a token?
- Should the 14 workflows be merged into one release workflow? Bulk `npm trust` makes this possible, but it is a bigger change than this migration needs.

## Sources

These were taken from search results and not read in full. Confirm details before acting on them.

- [npm bulk trusted publishing config and script security now generally available](https://github.blog/changelog/2026-02-18-npm-bulk-trusted-publishing-config-and-script-security-now-generally-available/) (GitHub Changelog)
- [Multiple trusted publishing configurations for npm](https://github.blog/changelog/2026-09-03-multiple-trusted-publishing-configurations-for-npm/) (GitHub Changelog)
- [npm Trusted Publishing flaw exposed 1,500+ npm packages to takeover](https://www.helpnetsecurity.com/2026/10/13/slugfest-npm-trusted-publishing-flaw/) (Help Net Security)
- [npm Trusted Publishing Now Supports Up to 10 OIDC Configurations Per Package](https://aicybr.com/blog/npm-multiple-trusted-publishing-oidc-configurations)
- [Secure npm package publishing in 2026: A Complete Guide](https://orbitant.com/en/secure-npm-package-publishing-2026/)
- [npm's roadmap: safer publishing, smoother workflows](https://github.com/orgs/community/discussions/208130) (GitHub Community)
