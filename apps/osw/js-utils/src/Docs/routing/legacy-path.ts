import type { DocsEntry } from '../model';

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/**
 * Maps the old TypeDoc URLs still linked from READMEs and search engines
 * (`/js-utils/modules/_array_async_map_.html`, `/js-utils/classes/_smart_map_.smartmap.html`)
 * to an entry id. Returns `null` for other `.html` pages (index, globals), which go to the overview.
 */
export function resolveLegacyPath(rest: string, entries: DocsEntry[]): string | null {
	const page = rest.split('/').pop() ?? '';
	const moduleName = normalize(page.replace(/\.html$/, '').split('.')[0]);
	if (!moduleName) return null;

	return entries.find((entry) => normalize(entry.id) === moduleName)?.id ?? null;
}
