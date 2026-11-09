import { useMemo, useState } from 'react';
import { libraries } from '../data';
import { CATALOG_ID } from '../hero';
import { CatalogFilters } from './CatalogFilters';
import { EcosystemSection } from './EcosystemSection';
import { groupLibraries, type EcosystemFilter } from './filter-libraries';

export function Catalog() {
	const [query, setQuery] = useState('');
	const [filter, setFilter] = useState<EcosystemFilter>('all');
	const groups = useMemo(() => groupLibraries(libraries, filter, query), [filter, query]);

	const reset = () => {
		setQuery('');
		setFilter('all');
	};

	return (
		<section id={CATALOG_ID} aria-labelledby="catalog-title" className="scroll-mt-20 px-4 pb-24 sm:px-6">
			<div className="mx-auto max-w-6xl">
				<h2 id="catalog-title" className="mb-6 text-2xl font-semibold tracking-tight text-neutral-990">
					Libraries
				</h2>

				<CatalogFilters query={query} onQueryChange={setQuery} filter={filter} onFilterChange={setFilter} />

				<div className="mt-10 flex flex-col gap-12" aria-live="polite">
					{groups.map((group) => (
						<EcosystemSection key={group.ecosystem.id} {...group} />
					))}

					{groups.length === 0 && (
						<div className="rounded-xl border border-dashed border-neutral-250 px-6 py-16 text-center">
							<p className="text-neutral-990">No libraries match “{query.trim()}”.</p>
							<button type="button" onClick={reset} className="mt-3 text-sm font-medium text-secondary-800 hover:underline">
								Clear filters
							</button>
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
