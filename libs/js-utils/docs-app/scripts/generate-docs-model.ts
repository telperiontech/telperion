/**
 * Generates `docs-model.json` for the osw/js-utils docs remote from the js-utils sources.
 *
 * Usage: node -r @swc-node/register libs/js-utils/docs-app/scripts/generate-docs-model.ts [--out <path>] [--strict]
 *   --strict  exit with an error when a module is undocumented or an extension can't be matched
 */
import { join } from 'node:path';
// Relative: plain `node -r @swc-node/register` does not apply tsconfig paths
import { generateApiModel } from '../../../../apps/osw/kit/api/generator';

generateApiModel({
	workspaceRoot: join(__dirname, '../../../..'),
	libRoot: 'libs/js-utils',
	packageName: '@telperion/js-utils',
	tagPrefix: 'js-utils-v',
	out: 'libs/js-utils/docs-app/src/generated/docs-model.json',
	categories: {
		core: { title: 'Core', description: 'General-purpose helpers and data structures.' },
		array: { title: 'Array', description: 'Set-like operations, async mapping, slicing and de-duplication for arrays.' },
		object: { title: 'Object', description: 'Deep cloning, freezing, mapping and compacting objects.' },
		function: { title: 'Function', description: 'Debouncing, deferring and composing functions.' },
		promise: { title: 'Promise', description: 'Timeouts, retries, chaining, error tuples and other promise flow helpers.' },
		error: { title: 'Error', description: 'Turning thrown values into readable messages.' },
		url: { title: 'URL', description: 'Trailing slashes and open-redirect-safe relative paths.' },
		map: { title: 'Map', description: 'Helpers for Map instances.' },
		math: { title: 'Math', description: 'Numeric helpers.' },
		string: { title: 'String', description: 'Limiting length and escaping HTML.' },
		time: { title: 'Time', description: 'Readable durations in milliseconds, and parsing duration strings like 15m.' },
		class: { title: 'Class', description: 'Class composition helpers.' },
		boolean: { title: 'Boolean', description: 'Truthiness checks.' },
		set: { title: 'Set', description: 'Helpers for Set instances.' },
	},
});
