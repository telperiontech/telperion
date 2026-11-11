import { GalleryCard } from '@osw/docs';
import type { EntryDoc } from '../model';
import { PreviewFrame } from '../preview-frame';
import { entryPath } from '../routing';
import { storiesOf } from '../stories';

/** A live preview (iframe) of an entry's first story, linking to its docs */
export function GalleryTile({ entry }: { entry: EntryDoc }) {
	const stories = storiesOf(entry);
	const first = stories[0];
	const elementCount = entry.elements.length;

	const preview = first ? (
		<PreviewFrame
			title={`${entry.title} preview`}
			componentId={first.component.id}
			storyId={first.story.id}
			args={{}}
			events={[]}
			height={224}
			className="pointer-events-none bg-neutral-20"
		/>
	) : (
		<div className="grid h-56 place-items-center bg-neutral-20 font-mono text-sm text-neutral-850">{`<${entry.elements[0]?.tagName}>`}</div>
	);

	return (
		<GalleryCard
			href={entryPath(entry.id)}
			title={entry.title}
			preview={preview}
			meta={`${elementCount} ${elementCount === 1 ? 'element' : 'elements'} · ${stories.length} stories`}
			summary={entry.summary.replace(/`/g, '')}
			cta="Docs and playground"
		/>
	);
}
