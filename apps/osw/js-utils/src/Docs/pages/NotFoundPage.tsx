import { AppLink } from '../../../../ui';
import { overviewPath } from '../routing';

export function NotFoundPage() {
	return (
		<div className="py-16 text-center">
			<p className="font-mono text-sm font-semibold text-primary-600">404</p>
			<h1 className="mt-3 text-2xl font-semibold tracking-tight">No such module</h1>
			<p className="mt-3 text-neutral-920">It may have been renamed or removed in this version.</p>
			<AppLink
				href={overviewPath()}
				className="mt-6 inline-flex rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
			>
				Browse all modules
			</AppLink>
		</div>
	);
}
