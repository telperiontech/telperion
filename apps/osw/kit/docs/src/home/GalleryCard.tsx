import type { ReactNode } from 'react';
import { Icon } from '@osw/react';

interface GalleryCardProps {
	href: string;
	title: string;
	/** Live preview on top of the card */
	preview: ReactNode;
	/** Short facts next to the title (counts, …) */
	meta: ReactNode;
	summary?: string;
	/** Visual call to action at the bottom; the whole card is the link */
	cta: string;
}

/**
 * A gallery card with a live preview. Previews (paint worklets, iframes) cannot sit inside
 * an `<a href>`, so the title's link is stretched over the card (`::after`) instead.
 */
export function GalleryCard({ href, title, preview, meta, summary, cta }: GalleryCardProps) {
	return (
		<div className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-100 transition-[border-color,box-shadow] hover:border-secondary-300 hover:shadow-lg hover:shadow-secondary-500/10">
			{preview}
			<div className="flex flex-1 flex-col border-t border-neutral-100 p-5">
				<div className="flex items-baseline justify-between gap-2">
					<h3 className="font-semibold group-hover:text-secondary-800">
						<a
							href={href}
							className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-secondary-600"
						>
							{title}
						</a>
					</h3>
					<span className="text-xs text-neutral-850">{meta}</span>
				</div>
				{summary && <p className="mt-1 text-sm text-neutral-920">{summary}</p>}
				<span aria-hidden="true" className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-medium text-secondary-800">
					{cta}
					<Icon name="arrow_forward" size={14} />
				</span>
			</div>
		</div>
	);
}
