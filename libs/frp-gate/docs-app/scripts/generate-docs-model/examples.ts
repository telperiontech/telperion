import { readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import type { Example } from '../../src/model/types';

const LANGUAGES: Record<string, string> = { yml: 'yaml', yaml: 'yaml', toml: 'toml', env: 'dotenv', example: 'dotenv' };
/** Shiki has no Caddyfile grammar: plain text, like the README's caddyfile fences */
const languageOf = (path: string) => (posix.basename(path) === 'Caddyfile' ? 'text' : LANGUAGES[path.split('.').pop() ?? ''] ?? 'text');

function filesIn(root: string, dir = ''): string[] {
	return readdirSync(join(root, dir), { withFileTypes: true })
		.flatMap((entry) => {
			const path = dir ? `${dir}/${entry.name}` : entry.name;

			return entry.isDirectory() ? filesIn(root, path) : [path];
		})
		.sort();
}

/**
 * Every file of `examples/`, described by the README's Quick start table
 * (`| [\`compose.yml\`](examples/compose.yml) | the three services |`), in the table's order.
 */
export function examples(examplesRoot: string, quickStartRows: string[][], problems: string[]): Example[] {
	const descriptions = new Map(
		quickStartRows.flatMap(([file = '', description = '']) => {
			const path = /\]\(examples\/([^)]+)\)/.exec(file)?.[1];

			return path ? [[path, description] as const] : [];
		}),
	);
	const order = [...descriptions.keys()];
	const rank = (path: string) => (order.includes(path) ? order.indexOf(path) : order.length);

	return filesIn(examplesRoot)
		.sort((a, b) => rank(a) - rank(b))
		.map((path) => {
			if (!descriptions.has(path)) problems.push(`examples/${path} is not described in the README's Quick start table`);

			return { path, language: languageOf(path), code: readFileSync(join(examplesRoot, path), 'utf8').trimEnd(), description: descriptions.get(path) ?? '' };
		});
}
