import { NotFound } from '@osw/docs';
import { homePath } from '../routing';

export function NotFoundPage() {
	return (
		<main className="px-4">
			<NotFound title="No such element or story" backHref={homePath()} backLabel="Back to elements" className="py-24" />
		</main>
	);
}
