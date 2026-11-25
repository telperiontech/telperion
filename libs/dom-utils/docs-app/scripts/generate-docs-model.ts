/**
 * Generates `docs-model.json` for the osw/dom-utils docs remote from the dom-utils sources.
 *
 * Usage: node -r @swc-node/register libs/dom-utils/docs-app/scripts/generate-docs-model.ts [--out <path>] [--strict]
 *   --strict  exit with an error when a module is undocumented
 */
import { join } from 'node:path';
// Relative: plain `node -r @swc-node/register` does not apply tsconfig paths
import { generateApiModel } from '../../../../apps/osw/kit/api/generator';

generateApiModel({
	workspaceRoot: join(__dirname, '../../../..'),
	libRoot: 'libs/dom-utils',
	packageName: '@telperion/dom-utils',
	tagPrefix: 'dom-utils-v',
	out: 'libs/dom-utils/docs-app/src/generated/docs-model.json',
	categories: {
		core: { title: 'Core', description: 'Traversal and live-mirroring helpers for DOM elements.' },
	},
});
