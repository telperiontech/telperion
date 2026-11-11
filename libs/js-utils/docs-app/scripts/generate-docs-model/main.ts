/**
 * Generates `docs-model.json` for the osw/js-utils docs remote from the js-utils sources.
 *
 * Usage: node -r @swc-node/register libs/js-utils/docs-app/scripts/generate-docs-model/main.ts [--out <path>] [--strict]
 *   --strict  exit with an error when a module is undocumented or an extension can't be matched
 */
import { join } from 'node:path';
import { buildModel } from './build-model';
import { TAG_PREFIX, WORKSPACE_ROOT } from './config';
import { createLibraryProgram } from './program';
// Relative: plain `node -r @swc-node/register` does not apply tsconfig paths
import { argValue, writeJson } from '../../../../../apps/osw/kit/build/src/model-cli';
import { resolveVersion } from '../../../../../apps/osw/kit/build/src/resolve-version';

const DEFAULT_OUT = 'libs/js-utils/docs-app/src/generated/docs-model.json';

const out = join(WORKSPACE_ROOT, argValue('--out') ?? DEFAULT_OUT);
const { model, warnings } = buildModel(createLibraryProgram(), resolveVersion(TAG_PREFIX, WORKSPACE_ROOT));

writeJson(out, model);

warnings.forEach((warning) => console.warn(`warn: ${warning}`));
console.log(`docs-model: ${model.entries.length} modules in ${model.categories.length} categories, v${model.version} → ${out}`);

if (warnings.length && process.argv.includes('--strict')) process.exit(1);
