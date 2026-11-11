import { NotFound } from '@osw/docs';
import { homePath } from '../routing';

export function NotFoundPage() {
	return (
		<main className="px-4">
			<NotFound title="No such paintlet or story" backHref={homePath()} backLabel="Back to paintlet" className="py-24" />
		</main>
	);
}
