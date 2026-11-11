import { execSync } from 'node:child_process';

/** Highest `<tagPrefix>X.Y.Z` git tag, if tags are available (CI checkouts need `fetch-tags`) */
function latestTagVersion(tagPrefix: string, cwd?: string): string | undefined {
	try {
		const tags = execSync(`git tag --list "${tagPrefix}*" --sort=-v:refname`, { cwd, encoding: 'utf8' });

		return tags.split(/\r?\n/).find(Boolean)?.slice(tagPrefix.length);
	} catch {
		return undefined;
	}
}

/**
 * Version a docs remote is built for: `PACKAGE_VERSION` (set by the publish workflow),
 * else the latest release tag (e.g. `paintlet-v`), else `dev`.
 */
export function resolveVersion(tagPrefix: string, cwd?: string): string {
	return process.env['PACKAGE_VERSION'] || latestTagVersion(tagPrefix, cwd) || 'dev';
}
