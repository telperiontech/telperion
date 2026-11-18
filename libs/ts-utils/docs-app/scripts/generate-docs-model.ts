/**
 * Generates `docs-model.json` for the osw/ts-utils docs remote from the ts-utils sources.
 *
 * Usage: node -r @swc-node/register libs/ts-utils/docs-app/scripts/generate-docs-model.ts [--out <path>] [--strict]
 *   --strict  exit with an error when a module is undocumented
 */
import { join } from 'node:path';
// Relative: plain `node -r @swc-node/register` does not apply tsconfig paths
import { generateApiModel } from '../../../../apps/osw/kit/api/generator';

generateApiModel({
	workspaceRoot: join(__dirname, '../../../..'),
	libRoot: 'libs/ts-utils',
	packageName: '@telperion/ts-utils',
	tagPrefix: 'ts-utils-v',
	out: 'libs/ts-utils/docs-app/src/generated/docs-model.json',
	categories: {
		core: { title: 'Core', description: 'Decorators and helpers for TypeScript classes.' },
	},
});
