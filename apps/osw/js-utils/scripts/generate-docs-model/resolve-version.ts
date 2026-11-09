import { execSync } from 'node:child_process';
import { TAG_PREFIX, WORKSPACE_ROOT } from './config';

/** Highest `js-utils-vX.Y.Z` git tag, if tags are available (CI checkouts need `fetch-tags`) */
function latestTagVersion(): string | undefined {
	try {
		const tags = execSync(`git tag --list "${TAG_PREFIX}*" --sort=-v:refname`, { cwd: WORKSPACE_ROOT, encoding: 'utf8' });
		return tags.split(/\r?\n/).find(Boolean)?.slice(TAG_PREFIX.length);
	} catch {
		return undefined;
	}
}

/** `PACKAGE_VERSION` (set by the publish workflow), else the latest release tag, else `dev` */
export function resolveVersion(): string {
	return process.env['PACKAGE_VERSION'] || latestTagVersion() || 'dev';
}
