import { useMemo } from 'react';
import { NotFound, usePageMeta } from '@osw/docs';
import { usePathname } from '@osw/react';
import { DocsLayout } from './layout';
import { DocPage, OverviewPage } from './pages';
import { homePath, resolveRoute, type Route } from './routing';

function pageTitle(route: Route): string {
	if (route.type === 'page') return `${route.page.title} · frp-gate`;

	return 'frp-gate · Telperion Open Source';
}

function activeSlug(route: Route): string | undefined {
	if (route.type === 'home') return '';

	return route.type === 'page' ? route.page.slug : undefined;
}

function Page({ route }: { route: Route }) {
	switch (route.type) {
		case 'home':
			return <OverviewPage />;
		case 'page':
			return <DocPage page={route.page} />;
		default:
			return <NotFound title="No such page" backHref={homePath()} backLabel="Back to frp-gate" />;
	}
}

export default function Docs() {
	const pathname = usePathname();
	const route = useMemo(() => resolveRoute(pathname), [pathname]);

	usePageMeta(pageTitle(route), route);

	return (
		<DocsLayout activeSlug={activeSlug(route)}>
			<Page route={route} />
		</DocsLayout>
	);
}
