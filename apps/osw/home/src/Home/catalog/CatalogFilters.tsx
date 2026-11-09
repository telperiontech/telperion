import { ecosystems, libraries } from '../data';
import { ecosystemTones, Icon } from '../ui';
import type { EcosystemFilter } from './filter-libraries';

interface CatalogFiltersProps {
	query: string;
	onQueryChange: (query: string) => void;
	filter: EcosystemFilter;
	onFilterChange: (filter: EcosystemFilter) => void;
}

const chipBase = 'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors';
const chipAllOn = 'border-transparent bg-linear-to-r from-primary-600 to-secondary-600 text-white shadow-sm shadow-secondary-500/25';
const chipOff = 'border-neutral-100 bg-white text-neutral-920 hover:border-secondary-300 hover:text-neutral-990';

const countFor = (filter: EcosystemFilter) =>
	filter === 'all' ? libraries.length : libraries.filter((lib) => lib.ecosystem === filter).length;

export function CatalogFilters({ query, onQueryChange, filter, onFilterChange }: CatalogFiltersProps) {
	const chips: { id: EcosystemFilter; label: string; dot?: string; on: string }[] = [
		{ id: 'all', label: 'All', on: chipAllOn },
		...ecosystems.map((e) => ({ id: e.id, label: e.label, dot: ecosystemTones[e.id].dot, on: ecosystemTones[e.id].chip })),
	];

	return (
		<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<div role="group" aria-label="Filter by ecosystem" className="flex flex-wrap gap-2">
				{chips.map((chip) => {
					const active = filter === chip.id;
					return (
						<button
							key={chip.id}
							type="button"
							aria-pressed={active}
							onClick={() => onFilterChange(chip.id)}
							className={`${chipBase} ${active ? chip.on : chipOff}`}
						>
							{chip.dot && <span aria-hidden="true" className={`size-2 rounded-full ${chip.dot}`} />}
							{chip.label}
							<span className={`font-mono text-xs ${active ? 'opacity-70' : 'text-neutral-850'}`}>{countFor(chip.id)}</span>
						</button>
					);
				})}
			</div>

			<label className="relative flex items-center md:w-72">
				<span className="sr-only">Search libraries</span>
				<span className="pointer-events-none absolute left-3 flex text-neutral-850">
					<Icon name="search" size={18} />
				</span>
				<input
					type="search"
					value={query}
					onChange={(event) => onQueryChange(event.target.value)}
					placeholder="Search libraries…"
					className="w-full rounded-lg border border-neutral-100 bg-white py-2 pr-3 pl-9 text-sm text-neutral-990 placeholder:text-neutral-850 outline-none focus:border-secondary-400 focus:ring-2 focus:ring-secondary-500/20 transition"
				/>
			</label>
		</div>
	);
}
