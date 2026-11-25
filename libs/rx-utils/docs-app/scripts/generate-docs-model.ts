/**
 * Generates `docs-model.json` for the osw/rx-utils docs remote from the rx-utils sources.
 *
 * Usage: node -r @swc-node/register libs/rx-utils/docs-app/scripts/generate-docs-model.ts [--out <path>] [--strict]
 *   --strict  exit with an error when a module is undocumented
 */
import { join } from 'node:path';
// Relative: plain `node -r @swc-node/register` does not apply tsconfig paths
import { generateApiModel } from '../../../../apps/osw/kit/api/generator';

generateApiModel({
	workspaceRoot: join(__dirname, '../../../..'),
	libRoot: 'libs/rx-utils',
	packageName: '@telperion/rx-utils',
	tagPrefix: 'rx-utils-v',
	out: 'libs/rx-utils/docs-app/src/generated/docs-model.json',
	rootCategory: 'core',
	categories: {
		operators: { title: 'Operators', description: 'Pipeable operators for buffering, multicasting and picking values.' },
		core: { title: 'Creation & interop', description: 'Observables from callbacks, Observables as async iterables, and a queue that runs tasks one at a time.' },
	},
	extensionBases: { 'static/async-iterator': 'to-async-iteratable' },
});
