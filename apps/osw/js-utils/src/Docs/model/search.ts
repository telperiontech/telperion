import type { DocsEntry } from './types';

/** Searchable text per entry: names of every export and patched member, id and summary */
function haystack(entry: DocsEntry): string {
	return [
		entry.id,
		entry.primary.name,
		entry.primary.summary,
		...entry.related.map((declaration) => declaration.name),
		...entry.extensions.flatMap((extension) => extension.members.map((member) => `${extension.target}.${member}`)),
	]
		.join(' ')
		.toLowerCase();
}

const cache = new WeakMap<DocsEntry, string>();

/** Every whitespace-separated term of the query must appear somewhere in the entry */
export function matchesQuery(entry: DocsEntry, query: string): boolean {
	const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (!terms.length) return true;

	if (!cache.has(entry)) cache.set(entry, haystack(entry));
	const text = cache.get(entry)!;
	return terms.every((term) => text.includes(term));
}
