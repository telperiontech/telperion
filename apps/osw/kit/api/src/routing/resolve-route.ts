import { pathSegments } from '@osw/docs';
import type { ApiDocs } from '../config';
import type { DocsCategory, DocsEntry } from '../model';

export type ApiRoute =
	| { type: 'overview' }
	| { type: 'category'; category: DocsCategory }
	| { type: 'entry'; entry: DocsEntry }
	| { type: 'redirect'; to: string }
	| { type: 'not-found' };

/** Resolves a pathname under `basePath`; entry ids win over category ids */
export function resolveRoute(pathname: string, docs: ApiDocs): ApiRoute {
	const segments = pathSegments(pathname, docs.basePath);

	if (!segments) return { type: 'not-found' };

	const rest = segments.join('/');

	if (!rest) return { type: 'overview' };

	if (docs.resolveLegacyPath && rest.endsWith('.html')) {
		const id = docs.resolveLegacyPath(rest, docs.model.entries);

		return { type: 'redirect', to: id ? docs.docsPath(id) : docs.overviewPath() };
	}

	const entry = docs.getEntry(rest);

	if (entry) return { type: 'entry', entry };

	const category = docs.getCategory(rest);

	if (category) return { type: 'category', category };

	return { type: 'not-found' };
}
