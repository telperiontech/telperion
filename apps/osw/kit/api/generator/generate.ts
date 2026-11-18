import { join } from 'node:path';
// Relative: plain `node -r @swc-node/register` does not apply tsconfig paths
import { argValue, writeJson } from '../../build/src/model-cli';
import { resolveVersion } from '../../build/src/resolve-version';
import { buildModel } from './build-model';
import type { ApiModelConfig } from './config';
import { createLibraryProgram } from './program';

/**
 * Generates a library's `docs-model.json` and reports warnings. Called from a docs remote's
 * generator script; honours `--out <path>` and `--strict` (exit 1 on any warning).
 */
export function generateApiModel(config: ApiModelConfig): void {
	const out = join(config.workspaceRoot, argValue('--out') ?? config.out);
	const version = resolveVersion(config.tagPrefix, config.workspaceRoot);
	const { model, warnings } = buildModel(createLibraryProgram(config), version, config);

	writeJson(out, model);

	warnings.forEach((warning) => console.warn(`warn: ${warning}`));
	console.log(`docs-model: ${model.entries.length} modules in ${model.categories.length} categories, v${model.version} → ${out}`);

	if (warnings.length && process.argv.includes('--strict')) process.exit(1);
}
