#!/usr/bin/env node
// Checks that a tag created with a GitHub App installation token starts a
// `push: tags` workflow, once through the Releases API and once through the Git
// refs API (Beacon's release mechanism depends on it, see DESIGN.md). It creates
// throwaway beacon-probe-* tags that start .github/workflows/beacon-tag-probe.yml,
// waits for a run per tag, and deletes the tags and the release again.
//
// usage: BEACON_PROBE_TOKEN=... node verify-app-tag-trigger.mjs --repo OWNER/NAME [--ref main] [--timeout 180]
//
// The token needs Contents read/write and Actions read on the repo. It is read
// from the environment only and never printed.
import { parseArgs } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';

import { GitHubError, githubRest } from './lib/github-rest.mjs';

const WORKFLOW = 'beacon-tag-probe.yml';
const POLL_INTERVAL_MS = 5000;

const { values: args } = parseArgs({
  options: {
    repo: { type: 'string' },
    ref: { type: 'string', default: 'main' },
    timeout: { type: 'string', default: '180' },
  },
});
const token = process.env.BEACON_PROBE_TOKEN;
if (!args.repo || !/^[\w.-]+\/[\w.-]+$/.test(args.repo) || !token) {
  console.error('usage: BEACON_PROBE_TOKEN=<installation token> node verify-app-tag-trigger.mjs --repo OWNER/NAME [--ref main] [--timeout 180]');
  process.exit(2);
}

const gh = githubRest(token, process.env.GITHUB_API_URL);
const repo = `/repos/${args.repo}`;
const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);

/** The two ways Beacon can create a release tag. */
const mechanisms = [
  {
    name: 'Releases API',
    tag: `beacon-probe-${stamp}-release`,
    create: (tag, sha) =>
      gh.post(`${repo}/releases`, {
        tag_name: tag,
        target_commitish: sha,
        name: tag,
        body: 'Throwaway release from apps/beacon/scripts/verify-app-tag-trigger.mjs; deleted after the check.',
        prerelease: true,
        make_latest: 'false',
      }),
    remove: async (tag, release) => {
      await ignoreMissing(() => gh.delete(`${repo}/releases/${release.id}`));
      await ignoreMissing(() => gh.delete(`${repo}/git/refs/tags/${tag}`));
    },
  },
  {
    name: 'Git refs API',
    tag: `beacon-probe-${stamp}-ref`,
    create: (tag, sha) => gh.post(`${repo}/git/refs`, { ref: `refs/tags/${tag}`, sha }),
    remove: (tag) => ignoreMissing(() => gh.delete(`${repo}/git/refs/tags/${tag}`)),
  },
];

/** Runs `request`, treating "already gone" as success. */
async function ignoreMissing(request) {
  try {
    await request();
  } catch (err) {
    if (!(err instanceof GitHubError && (err.status === 404 || err.status === 422))) throw err;
  }
}

/** The probe workflow's push runs for these tags, created since `since`. */
async function runsFor(tags, since) {
  const query = new URLSearchParams({ event: 'push', created: `>=${since}`, per_page: '50' });
  const { workflow_runs: runs } = await gh.get(`${repo}/actions/workflows/${WORKFLOW}/runs?${query}`);
  return new Map(runs.filter((run) => tags.includes(run.head_branch)).map((run) => [run.head_branch, run]));
}

/** Polls until every tag has a run or the timeout passes. */
async function waitForRuns(tags, since, deadline) {
  const found = await runsFor(tags, since);
  if (found.size === tags.length || Date.now() >= deadline) return found;
  await sleep(POLL_INTERVAL_MS);
  return waitForRuns(tags, since, deadline);
}

async function main() {
  const { sha } = await gh.get(`${repo}/commits/${encodeURIComponent(args.ref)}`);
  await gh.get(`${repo}/contents/.github/workflows/${WORKFLOW}?ref=${sha}`).catch((err) => {
    throw err instanceof GitHubError && err.status === 404
      ? new Error(`${args.ref} (${sha.slice(0, 7)}) has no .github/workflows/${WORKFLOW}; push it first or pass --ref`)
      : err;
  });
  console.log(`tagging ${args.repo}@${sha.slice(0, 7)} (${args.ref}); waiting up to ${args.timeout}s per run`);

  const since = new Date(Date.now() - 60_000).toISOString().slice(0, 19) + 'Z';
  const created = [];
  try {
    for (const m of mechanisms) {
      created.push({ m, result: await m.create(m.tag, sha) });
      console.log(`created ${m.tag} via ${m.name}`);
    }
    const runs = await waitForRuns(
      mechanisms.map((m) => m.tag),
      since,
      Date.now() + Number(args.timeout) * 1000,
    );
    const results = mechanisms.map((m) => ({ m, run: runs.get(m.tag) }));
    for (const { m, run } of results) {
      console.log(
        run
          ? `PASS ${m.name}: run ${run.id} (${run.status}) by ${run.triggering_actor?.login ?? run.actor?.login}: ${run.html_url}`
          : `FAIL ${m.name}: no ${WORKFLOW} run for ${m.tag} within ${args.timeout}s`,
      );
    }
    return results.every((r) => r.run) ? 0 : 1;
  } finally {
    for (const { m, result } of created) {
      await m.remove(m.tag, result).then(
        () => console.log(`deleted ${m.tag}`),
        (err) => console.error(`could not delete ${m.tag} (${m.name}), remove it by hand: ${err.message}`),
      );
    }
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`error: ${err.message}`);
    process.exit(1);
  },
);
