import { useMemo } from 'react';
import { usePageMeta } from '@osw/docs';
import { usePathname } from '@osw/react';
import { EntryPage } from './entry';
import { HomePage } from './home';
import { DocsLayout, EntryLayout } from './layout';
import { NotFoundPage } from './pages';
import { PlaygroundPage } from './playground';
import { resolveRoute, type Route } from './routing';

function pageTitle(route: Route): string {
	switch (route.type) {
		case 'entry':
			return `${route.entry.title} · elements`;
		case 'playground':
			return `${route.story.name} · ${route.entry.title} · elements`;
		default:
			return 'elements · Telperion Open Source';
	}
}

function Page({ route }: { route: Route }) {
	switch (route.type) {
		case 'home':
			return <HomePage />;
		case 'entry':
			return (
				<EntryLayout activeEntryId={route.entry.id}>
					<EntryPage entry={route.entry} />
				</EntryLayout>
			);
		case 'playground':
			return (
				<EntryLayout activeEntryId={route.entry.id} activeStoryId={route.story.id}>
					{/* Keyed so each story starts from its own args (and the query string) */}
					<PlaygroundPage key={`${route.entry.id}/${route.story.id}`} entry={route.entry} component={route.component} story={route.story} />
				</EntryLayout>
			);
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
