import { useEffect, useMemo } from 'react';
import { navigate, usePathname } from '../../../ui';
import { DocsLayout } from './layout';
import { CategoryPage, EntryPage, NotFoundPage, OverviewPage } from './pages';
import { resolveRoute, type Route } from './routing';

function pageTitle(route: Route): string {
	if (route.type === 'entry') return `${route.entry.primary.name} · js-utils`;
	if (route.type === 'category') return `${route.category.title} · js-utils`;
	return 'js-utils · Telperion Open Source';
}

function activeId(route: Route): string | undefined {
	if (route.type === 'entry') return route.entry.id;
	if (route.type === 'category') return route.category.id;
	return undefined;
}

function Page({ route }: { route: Route }) {
	switch (route.type) {
		case 'overview':
			return <OverviewPage />;
		case 'category':
			return <CategoryPage category={route.category} />;
		case 'entry':
			return <EntryPage entry={route.entry} />;
		default:
			return <NotFoundPage />;
	}
}

export default function Docs() {
	const pathname = usePathname();
	const route = useMemo(() => resolveRoute(pathname), [pathname]);

	useEffect(() => {
		if (route.type === 'redirect') navigate(route.to, { replace: true });
	}, [route]);

	useEffect(() => {
		document.title = pageTitle(route);
		if (!window.location.hash) window.scrollTo({ top: 0 });
	}, [route]);

	if (route.type === 'redirect') return null;

	return (
		<DocsLayout activeId={activeId(route)}>
			<Page route={route} />
		</DocsLayout>
	);
}
