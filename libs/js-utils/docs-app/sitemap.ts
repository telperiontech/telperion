import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SitemapOptions } from '@osw/build';
import type { DocsModel } from './src/Docs/model/types';

/** Must match `BASE_PATH` in `src/Docs/routing/paths.ts` (not imported: that module pulls in React) */
const BASE_PATH = '/js-utils';
const MODEL_PATH = join(__dirname, 'src/generated/docs-model.json');

/** Overview, category and entry pages from the generated docs model (`generate-model` runs before the build) */
export const sitemap: SitemapOptions = {
	dependencies: [MODEL_PATH],
	paths: () => {
		const model: DocsModel = JSON.parse(readFileSync(MODEL_PATH, 'utf8'));

		return [
			BASE_PATH,
			...model.categories.map((category) => `${BASE_PATH}/${category.id}`),
			...model.entries.map((entry) => `${BASE_PATH}/${entry.id}`),
		];
	},
};
