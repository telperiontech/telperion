import { NotFound } from '@osw/docs';
import { overviewPath } from '../routing';

export function NotFoundPage() {
	return <NotFound title="No such module" backHref={overviewPath()} backLabel="Browse all modules" />;
}
