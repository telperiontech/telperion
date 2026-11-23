import { Icon } from '@osw/react';
import { pageOrder } from '../model';
import { pagePath } from '../routing';

/** Links to the pages before and after `slug` in sidebar order */
export function PrevNext({ slug }: { slug: string }) {
	const index = pageOrder.findIndex((page) => page.slug === slug);
	const previous = pageOrder[index - 1];
	const next = pageOrder[index + 1];
	const card = 'flex min-w-0 flex-1 flex-col rounded-xl border border-neutral-40 px-4 py-3 transition-colors hover:border-secondary-240';

	return (
		<nav aria-label="Pages" className="mt-16 flex gap-3">
			{previous ? (
				<a href={pagePath(previous.slug)} className={card}>
					<span className="flex items-center gap-1 text-xs text-neutral-550"><Icon name="arrow_back" size={14} /> Previous</span>
					<span className="mt-1 truncate text-sm font-medium">{previous.title}</span>
				</a>
			) : <span className="flex-1" />}
			{next ? (
				<a href={pagePath(next.slug)} className={`${card} items-end text-right`}>
					<span className="flex items-center gap-1 text-xs text-neutral-550">Next <Icon name="arrow_forward" size={14} /></span>
					<span className="mt-1 truncate text-sm font-medium">{next.title}</span>
				</a>
			) : <span className="flex-1" />}
		</nav>
	);
}
