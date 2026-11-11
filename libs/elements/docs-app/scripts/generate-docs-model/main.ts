/**
 * Generates `elements-model.json` for the osw/elements docs remote from the
 * Custom Elements Manifest (`nx run elements:analyze`) and the entry READMEs.
 *
 * Usage: node -r @swc-node/register libs/elements/docs-app/scripts/generate-docs-model/main.ts [--out <path>] [--strict]
 *   --strict  exit with an error when an element is undocumented or outside every entry point
 */
import { join } from 'node:path';
// Relative: plain `node -r @swc-node/register` does not apply tsconfig paths
import { argValue, writeJson } from '../../../../../apps/osw/kit/build/src/model-cli';
import { resolveVersion } from '../../../../../apps/osw/kit/build/src/resolve-version';
import { buildModel } from './build-model';
import { DEFAULT_OUT, TAG_PREFIX, WORKSPACE_ROOT } from './config';
import { readManifest } from './manifest';

const out = join(WORKSPACE_ROOT, argValue('--out') ?? DEFAULT_OUT);
const { model, warnings } = buildModel(readManifest(), resolveVersion(TAG_PREFIX, WORKSPACE_ROOT));

writeJson(out, model);

const elementCount = model.entries.reduce((count, entry) => count + entry.elements.length, 0);
console.log(`Wrote ${model.entries.length} entries and ${elementCount} elements (v${model.version}) to ${out}`);

for (const warning of warnings) console.warn(`  warning: ${warning}`);

if (warnings.length && process.argv.includes('--strict')) process.exit(1);
