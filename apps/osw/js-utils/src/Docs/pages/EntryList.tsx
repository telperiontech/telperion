import { AppLink } from '../../../../ui';
import { extensionKinds, KindBadge } from '../entry';
import type { DocsEntry } from '../model';
import { docsPath } from '../routing';

/** Linked rows of entries with their summary and extension badges */
export function EntryList({ entries }: { entries: DocsEntry[] }) {
	return (
		<ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-100">
			{entries.map((entry) => (
				<li key={entry.id}>
					<AppLink href={docsPath(entry.id)} className="group flex flex-col gap-1 px-5 py-4 transition-colors hover:bg-neutral-20 sm:flex-row sm:items-baseline sm:gap-4">
						<span className="flex shrink-0 items-center gap-2 sm:w-56">
							<span className="font-mono text-sm font-semibold text-neutral-990 group-hover:text-secondary-800">{entry.primary.name}</span>
							{extensionKinds(entry).map((kind) => <KindBadge key={kind} kind={kind} />)}
						</span>
						<span className="text-sm text-neutral-920">{entry.primary.summary}</span>
					</AppLink>
				</li>
			))}
		</ul>
	);
}
