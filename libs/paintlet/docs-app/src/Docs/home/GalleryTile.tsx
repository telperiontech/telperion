import { Icon } from '@osw/react';
import { StoryCanvas } from '../canvas';
import { paintletPath } from '../routing';
import type { PaintletDoc } from '../stories';

/**
 * A live preview of a paintlet's first story, linking to its playground.
 * The preview must stay outside the `<a href>`: Chrome does not run paint worklets inside links,
 * so the card uses a stretched link (the title's `::after` covers the card) instead of wrapping it.
 */
export function GalleryTile({ paintlet }: { paintlet: PaintletDoc }) {
	const story = paintlet.stories[0];

	return (
		<div className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-100 transition-[border-color,box-shadow] hover:border-secondary-300 hover:shadow-lg hover:shadow-secondary-500/10">
			<StoryCanvas story={story} args={story.args} className="pointer-events-none h-56 bg-neutral-20 p-4" />
			<div className="flex flex-1 flex-col border-t border-neutral-100 p-5">
				<div className="flex items-baseline justify-between gap-2">
					<h3 className="font-semibold group-hover:text-secondary-800">
						<a
							href={paintletPath(paintlet.id)}
							className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-secondary-600"
						>
							{paintlet.title}
						</a>
					</h3>
					<span className="text-xs text-neutral-850">{paintlet.stories.length} stories</span>
				</div>
				{paintlet.summary && <p className="mt-1 text-sm text-neutral-920">{paintlet.summary}</p>}
				<span aria-hidden="true" className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-medium text-secondary-800">
					Play with it
					<Icon name="arrow_forward" size={14} />
				</span>
			</div>
		</div>
	);
}
