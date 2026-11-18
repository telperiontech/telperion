/**
 * Generates `docs-model.json` for the osw/extra-ts-types docs remote from the extra-ts-types sources.
 *
 * Usage: node -r @swc-node/register libs/extra-ts-types/docs-app/scripts/generate-docs-model.ts [--out <path>] [--strict]
 *   --strict  exit with an error when a module is undocumented
 */
import { join } from 'node:path';
// Relative: plain `node -r @swc-node/register` does not apply tsconfig paths
import { generateApiModel } from '../../../../apps/osw/kit/api/generator';

generateApiModel({
	workspaceRoot: join(__dirname, '../../../..'),
	libRoot: 'libs/extra-ts-types',
	packageName: '@telperion/extra-ts-types',
	tagPrefix: 'extra-ts-types-v',
	out: 'libs/extra-ts-types/docs-app/src/generated/docs-model.json',
	rootCategory: 'types',
	categories: {
		types: { title: 'Utility types', description: 'Type-level helpers for functions, constructors, tuples, strings and nested objects.' },
		polyfills: { title: 'Polyfills', description: 'Declarations for web APIs that TypeScript’s DOM library does not ship yet.' },
	},
});
