import { pathSegments } from '@osw/docs';
import { getCategory, getEntry, model, type DocsCategory, type DocsEntry } from '../model';
import { resolveLegacyPath } from './legacy-path';
import { BASE_PATH, docsPath, overviewPath } from './paths';

export type Route =
	| { type: 'overview' }
	| { type: 'category'; category: DocsCategory }
	| { type: 'entry'; entry: DocsEntry }
	| { type: 'redirect'; to: string }
	| { type: 'not-found' };

/** Resolves a pathname under `BASE_PATH`; entry ids win over category ids */
export function resolveRoute(pathname: string): Route {
	const segments = pathSegments(pathname, BASE_PATH);
	if (!segments) return { type: 'not-found' };

	const rest = segments.join('/');
	if (!rest) return { type: 'overview' };

	if (rest.endsWith('.html')) {
		const id = resolveLegacyPath(rest, model.entries);
		return { type: 'redirect', to: id ? docsPath(id) : overviewPath() };
	}

	const entry = getEntry(rest);
	if (entry) return { type: 'entry', entry };

	const category = getCategory(rest);
	if (category) return { type: 'category', category };

	return { type: 'not-found' };
}
