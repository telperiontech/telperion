import { useMemo } from 'react';
import { usePageMeta } from '@osw/docs';
import { usePathname } from '@osw/react';
import { HomePage } from './home';
import { DocsLayout } from './layout';
import { NotFoundPage } from './pages';
import { PlaygroundPage } from './playground';
import { resolveRoute, type Route } from './routing';

function pageTitle(route: Route): string {
	if (route.type === 'playground') return `${route.story.name} · ${route.paintlet.title} · paintlet`;

	return 'paintlet · Telperion Open Source';
}

function Page({ route }: { route: Route }) {
	switch (route.type) {
		case 'home':
			return <HomePage />;
		case 'playground':
			// Keyed so each story starts from its own args (and the query string)
			return <PlaygroundPage key={`${route.paintlet.id}/${route.story.id}`} paintlet={route.paintlet} story={route.story} />;
		default:
			return <NotFoundPage />;
	}
}

export default function Docs() {
	const pathname = usePathname();
	const route = useMemo(() => resolveRoute(pathname), [pathname]);

	usePageMeta(pageTitle(route), route);

	return (
		<DocsLayout>
			<Page route={route} />
		</DocsLayout>
	);
}
