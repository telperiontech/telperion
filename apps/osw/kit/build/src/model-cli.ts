import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Helpers for the docs-model generator scripts (run with `node -r @swc-node/register`) */

/** The value after `flag` on the command line */
export function argValue(flag: string): string | undefined {
	const index = process.argv.indexOf(flag);

	return index > -1 ? process.argv[index + 1] : undefined;
}

/** Writes `data` as pretty-printed JSON, creating its folder */
export function writeJson(path: string, data: unknown): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}
