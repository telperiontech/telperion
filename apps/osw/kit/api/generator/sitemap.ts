import { readFileSync } from 'node:fs';
import type { SitemapOptions } from '../../build/src/sitemap';
import type { DocsModel } from '../src/model/types';

/**
 * Sitemap of an API docs remote: overview, category and entry pages from its generated
 * docs model (`generate-model` runs before the build).
 */
export function apiSitemap(basePath: string, modelPath: string): SitemapOptions {
	return {
		dependencies: [modelPath],
		paths: () => {
			const model: DocsModel = JSON.parse(readFileSync(modelPath, 'utf8'));

			return [
				basePath,
				...model.categories.map((category) => `${basePath}/${category.id}`),
				...model.entries.map((entry) => `${basePath}/${entry.id}`),
			];
		},
	};
}
