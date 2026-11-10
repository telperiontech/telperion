/**
 * Generates `docs-model.json` for the osw/js-utils docs remote from the js-utils sources.
 *
 * Usage: node -r @swc-node/register libs/js-utils/docs-app/scripts/generate-docs-model/main.ts [--out <path>] [--strict]
 *   --strict  exit with an error when a module is undocumented or an extension can't be matched
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildModel } from './build-model';
import { WORKSPACE_ROOT } from './config';
import { createLibraryProgram } from './program';
import { resolveVersion } from './resolve-version';

const DEFAULT_OUT = 'libs/js-utils/docs-app/src/generated/docs-model.json';

function argValue(flag: string): string | undefined {
	const index = process.argv.indexOf(flag);
	return index > -1 ? process.argv[index + 1] : undefined;
}

const out = join(WORKSPACE_ROOT, argValue('--out') ?? DEFAULT_OUT);
const { model, warnings } = buildModel(createLibraryProgram(), resolveVersion());

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(model, null, 2) + '\n');

warnings.forEach((warning) => console.warn(`warn: ${warning}`));
console.log(`docs-model: ${model.entries.length} modules in ${model.categories.length} categories, v${model.version} → ${out}`);

if (warnings.length && process.argv.includes('--strict')) process.exit(1);
