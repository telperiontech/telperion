import { Inline } from '@osw/docs';
import type { DocsTag } from '../model';

interface TagTableProps {
	title: string;
	tags: DocsTag[];
}

/** Parameters / type parameters as a two-column definition list */
export function TagTable({ title, tags }: TagTableProps) {
	if (!tags.length) return null;

	return (
		<div className="mt-6">
			<h3 className="text-xs font-semibold tracking-wide text-neutral-850 uppercase">{title}</h3>
			<dl className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-100 text-sm">
				{tags.map((tag) => (
					<div key={tag.name} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
						<dt className="font-mono text-[13px] font-medium text-neutral-990">{tag.name}</dt>
						<dd className="text-neutral-920"><Inline text={tag.text || '—'} /></dd>
					</div>
				))}
			</dl>
		</div>
	);
}
