import { GalleryCard } from '@osw/docs';
import { StoryCanvas, type ComponentDoc } from '@osw/stories';
import { paintletPath } from '../routing';

/**
 * A live preview of a paintlet's first story, linking to its playground.
 * Chrome does not run paint worklets inside links, which is why `GalleryCard` keeps the preview out of its link.
 */
export function GalleryTile({ paintlet }: { paintlet: ComponentDoc }) {
	const story = paintlet.stories[0];

	return (
		<GalleryCard
			href={paintletPath(paintlet.id)}
			title={paintlet.title}
			preview={<StoryCanvas story={story} args={story.args} className="pointer-events-none h-56 bg-neutral-20 p-4" />}
			meta={`${paintlet.stories.length} stories`}
			summary={paintlet.summary}
			cta="Play with it"
		/>
	);
}
