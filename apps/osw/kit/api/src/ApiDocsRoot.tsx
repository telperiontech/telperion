import { useEffect, useMemo } from 'react';
import { navigate } from '@osw/core';
import { NotFound, usePageMeta } from '@osw/docs';
import { usePathname } from '@osw/react';
import { ApiDocsContext, type ApiDocs } from './config';
import { ApiLayout } from './layout';
import { CategoryPage, EntryPage } from './pages';
import { resolveRoute, type ApiRoute } from './routing';

function pageTitle(route: ApiRoute, name: string): string {
	if (route.type === 'entry') return `${route.entry.primary.name} · ${name}`;

	if (route.type === 'category') return `${route.category.title} · ${name}`;

	return `${name} · Telperion Open Source`;
}

/** Meta description: the entry's summary or the category's description; the shell's default otherwise */
function pageDescription(route: ApiRoute): string | undefined {
	if (route.type === 'entry') return route.entry.primary.summary || undefined;

	if (route.type === 'category') return route.category.description || undefined;

	return undefined;
}

function activeId(route: ApiRoute): string | undefined {
	if (route.type === 'entry') return route.entry.id;

	if (route.type === 'category') return route.category.id;

	return undefined;
}

function Page({ route, docs }: { route: ApiRoute; docs: ApiDocs }) {
	switch (route.type) {
		case 'overview':
			return <docs.overview />;
		case 'category':
			return <CategoryPage category={route.category} />;
		case 'entry':
			return <EntryPage entry={route.entry} />;
		default:
			return <NotFound title="No such module" backHref={docs.overviewPath()} backLabel="Browse all modules" />;
	}
}

/**
 * Root component of an API reference remote: routes the overview, category and entry
 * pages under `docs.basePath` and frames them with the module sidebar.
 */
export function ApiDocsRoot({ docs }: { docs: ApiDocs }) {
	const pathname = usePathname();
	const route = useMemo(() => resolveRoute(pathname, docs), [pathname, docs]);

	useEffect(() => {
		if (route.type === 'redirect') navigate(route.to, { replace: true });
	}, [route]);

	usePageMeta(pageTitle(route, docs.name), route, pageDescription(route));

	if (route.type === 'redirect') return null;

	return (
		<ApiDocsContext.Provider value={docs}>
			<ApiLayout activeId={activeId(route)}>
				<Page route={route} docs={docs} />
			</ApiLayout>
		</ApiDocsContext.Provider>
	);
}
