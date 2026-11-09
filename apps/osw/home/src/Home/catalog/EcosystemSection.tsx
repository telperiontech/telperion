import { LibraryCard } from '../card';
import { ecosystemTones } from '../ui';
import type { LibraryGroup } from './filter-libraries';

export function EcosystemSection({ ecosystem, libraries }: LibraryGroup) {
	const headingId = `ecosystem-${ecosystem.id}`;

	return (
		<section aria-labelledby={headingId}>
			<div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<h3 id={headingId} className="flex items-center gap-2 text-base font-semibold text-neutral-990">
					<span aria-hidden="true" className={`size-2 rounded-full ${ecosystemTones[ecosystem.id].dot}`} />
					{ecosystem.label}
				</h3>
				<p className="text-sm text-neutral-920">{ecosystem.blurb}</p>
			</div>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{libraries.map((library) => (
					<LibraryCard key={library.name} library={library} />
				))}
			</div>
		</section>
	);
}
