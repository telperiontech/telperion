import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SitemapOptions } from '@osw/build';
import type { ElementsModel } from './src/Docs/model/types';

/** Must match `BASE_PATH` in `src/Docs/routing/paths.ts` (not imported: that module pulls in React) */
const BASE_PATH = '/elements';
const MODEL_PATH = join(__dirname, 'src/generated/elements-model.json');

/**
 * Home and entry pages from the generated model (`generate-model` runs before the build).
 * Story playgrounds (`/elements/<entry>/<story>`) are left out: they are variations of the entry page.
 */
export const sitemap: SitemapOptions = {
	dependencies: [MODEL_PATH],
	paths: () => {
		const model: ElementsModel = JSON.parse(readFileSync(MODEL_PATH, 'utf8'));

		return [BASE_PATH, ...model.entries.map((entry) => `${BASE_PATH}/${entry.id}`)];
	},
};
