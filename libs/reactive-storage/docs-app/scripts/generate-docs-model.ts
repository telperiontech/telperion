/**
 * Generates `docs-model.json` for the osw/reactive-storage docs remote from the reactive-storage sources.
 *
 * Usage: node -r @swc-node/register libs/reactive-storage/docs-app/scripts/generate-docs-model.ts [--out <path>] [--strict]
 *   --strict  exit with an error when a module is undocumented
 */
import { join } from 'node:path';
// Relative: plain `node -r @swc-node/register` does not apply tsconfig paths
import { generateApiModel } from '../../../../apps/osw/kit/api/generator';

generateApiModel({
	workspaceRoot: join(__dirname, '../../../..'),
	libRoot: 'libs/reactive-storage',
	packageName: '@telperion/reactive-storage',
	tagPrefix: 'reactive-storage-v',
	out: 'libs/reactive-storage/docs-app/src/generated/docs-model.json',
	rootCategory: 'storages',
	categories: {
		storages: { title: 'Storages', description: 'Observable wrappers for localStorage, sessionStorage, any Web Storage and cookies, plus the base class they share.' },
	},
	// Internal helpers, not in the package's exports
	exclude: ['json-parse'],
});
