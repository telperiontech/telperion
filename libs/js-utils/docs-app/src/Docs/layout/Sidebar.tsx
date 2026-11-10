import { useMemo, useState } from 'react';
import { Icon } from '@osw/react';
import { entriesOf, matchesQuery, model } from '../model';
import { docsPath } from '../routing';

interface SidebarProps {
	/** Entry or category id of the current page, for the active state */
	activeId?: string;
	/** Called after a link is followed, e.g. to close the mobile drawer */
	onNavigate?: () => void;
}

const linkBase = 'block truncate rounded-md px-2 py-1 font-mono text-[13px] transition-colors';
const linkIdle = 'text-neutral-920 hover:bg-neutral-50 hover:text-neutral-990';
const linkActive = 'bg-secondary-100 font-medium text-secondary-850';

export function Sidebar({ activeId, onNavigate }: SidebarProps) {
	const [query, setQuery] = useState('');

	const groups = useMemo(
		() =>
			model.categories
				.map((category) => ({ category, entries: entriesOf(category).filter((entry) => matchesQuery(entry, query)) }))
				.filter((group) => group.entries.length),
		[query],
	);

	return (
		<nav aria-label="Modules" className="text-sm">
			<label className="relative block">
				<span className="sr-only">Search modules</span>
				<span className="pointer-events-none absolute inset-y-0 left-2.5 grid place-items-center text-neutral-550">
					<Icon name="search" size={16} />
				</span>
				<input
					type="search"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Search functions"
					className="w-full rounded-lg border border-neutral-100 bg-white py-2 pr-3 pl-8 text-sm text-neutral-990 placeholder:text-neutral-550 focus:border-secondary-300 focus:outline-none"
				/>
			</label>

			{groups.map(({ category, entries }) => (
				<section key={category.id} className="mt-5">
					<a
						href={docsPath(category.id)}
						onClick={onNavigate}
						className={`block px-2 text-xs font-semibold tracking-wide uppercase ${activeId === category.id ? 'text-secondary-800' : 'text-neutral-850 hover:text-neutral-990'}`}
					>
						{category.title}
					</a>
					<ul className="mt-1.5 space-y-0.5">
						{entries.map((entry) => (
							<li key={entry.id}>
								<a
									href={docsPath(entry.id)}
									onClick={onNavigate}
									aria-current={activeId === entry.id ? 'page' : undefined}
									className={`${linkBase} ${activeId === entry.id ? linkActive : linkIdle}`}
								>
									{entry.primary.name}
								</a>
							</li>
						))}
					</ul>
				</section>
			))}

			{!groups.length && <p className="mt-5 px-2 text-neutral-850">No modules match “{query}”.</p>}
		</nav>
	);
}
