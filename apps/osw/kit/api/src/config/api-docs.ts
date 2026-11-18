import type { ComponentType } from 'react';
import type { DocsCategory, DocsEntry, DocsModel } from '../model/types';

export interface ApiDocsOptions {
	/** Generated `docs-model.json` */
	model: DocsModel;
	/** Short library name for the nav, breadcrumbs and page titles, e.g. `js-utils` */
	name: string;
	/** Mount path in the shell; must match the shell's `<tp-route>`, e.g. `/js-utils` */
	basePath: string;
	/** Workspace-relative library folder, for the nav's source link, e.g. `libs/js-utils` */
	libRoot: string;
	/** Content of the overview page (`basePath` itself) */
	overview: ComponentType;
	/** The package ships a barrel per category (`<package>/array`); category pages then say so */
	categoryBarrels?: boolean;
	/**
	 * Maps an old `.html` docs URL (path below `basePath`) to an entry id. Without it, `.html`
	 * paths are not found; returning `null` redirects to the overview.
	 */
	resolveLegacyPath?: (rest: string, entries: DocsEntry[]) => string | null;
}

/** Options plus lookups and URL helpers, shared by every API docs component through context */
export interface ApiDocs extends ApiDocsOptions {
	getEntry: (id: string) => DocsEntry | undefined;
	getCategory: (id: string) => DocsCategory | undefined;
	entriesOf: (category: DocsCategory) => DocsEntry[];
	overviewPath: () => string;
	/** Docs URLs mirror import paths: `<package>/array/difference` → `<basePath>/array/difference` */
	docsPath: (id: string) => string;
}

/** Indexes the model once; call at module level of the remote and pass the result to `<ApiDocs>` */
export function createApiDocs(options: ApiDocsOptions): ApiDocs {
	const entriesById = new Map(options.model.entries.map((entry) => [entry.id, entry]));
	const categoriesById = new Map(options.model.categories.map((category) => [category.id, category]));

	return {
		...options,
		getEntry: (id) => entriesById.get(id),
		getCategory: (id) => categoriesById.get(id),
		entriesOf: (category) => category.entryIds.map((id) => entriesById.get(id)).filter((entry): entry is DocsEntry => !!entry),
		overviewPath: () => options.basePath,
		docsPath: (id) => `${options.basePath}/${id}`,
	};
}
