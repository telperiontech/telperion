import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SitemapOptions } from '@osw/build';
import type { DocsModel } from './src/model/types';
import { BASE_PATH } from './src/Docs/base-path';

const MODEL = join(__dirname, 'src/generated/docs-model.json');

/** The overview and one URL per page of the generated model */
export const sitemap: SitemapOptions = {
	paths: () => {
		const model = JSON.parse(readFileSync(MODEL, 'utf8')) as DocsModel;

		return [BASE_PATH, ...model.pages.map((page) => `${BASE_PATH}/${page.slug}`)];
	},
	dependencies: [MODEL],
};
