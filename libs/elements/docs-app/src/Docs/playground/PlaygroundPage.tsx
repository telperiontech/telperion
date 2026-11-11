import { useMemo } from 'react';
import { Icon } from '@osw/react';
import { Markdown } from '@osw/docs';
import { ControlsPanel, StoryHeader, useStoryArgs, type ComponentDoc, type StoryDoc } from '@osw/stories';
import { primitiveArgs } from '../../protocol/messages';
import { eventsOf, type EntryDoc } from '../model';
import { PreviewFrame } from '../preview-frame';
import { entryPath } from '../routing';
import { storyHtml } from '../snippet';
import { EventsPanel } from './EventsPanel';
import { HtmlPanel } from './HtmlPanel';
import { useEventLog } from './use-event-log';

interface PlaygroundPageProps {
	entry: EntryDoc;
	component: ComponentDoc;
	story: StoryDoc;
}

/** Fullscreen stories (e.g. the router demos) get a taller, scrollable stage */
const maxHeightOf = (story: StoryDoc) => (story.parameters.layout === 'fullscreen' ? 800 : 640);

export function PlaygroundPage({ entry, component, story }: PlaygroundPageProps) {
	const { args, update, reset, changed } = useStoryArgs(story);
	const { events, log, clear } = useEventLog();
	const eventNames = useMemo(() => eventsOf(entry), [entry]);
	const html = useMemo(() => storyHtml(story, args), [story, args]);
	// Only changed primitive args travel to the iframe; it holds the story's own defaults
	const overrides = useMemo(() => primitiveArgs(Object.fromEntries(changed.map((name) => [name, args[name]]))), [args, changed]);

	return (
		<>
			<StoryHeader component={component} story={story} args={args} />

			<PreviewFrame
				title={`${component.title}: ${story.name}`}
				componentId={component.id}
				storyId={story.id}
				args={overrides}
				events={eventNames}
				onEvent={log}
				minHeight={240}
				maxHeight={maxHeightOf(story)}
				className="mt-6 overflow-hidden rounded-xl border border-neutral-100 bg-neutral-20 bg-[radial-gradient(var(--color-neutral-100)_1px,transparent_1px)] bg-size-[16px_16px]"
			/>

			<div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
				<ControlsPanel story={story} args={args} changed={changed} onChange={update} onReset={reset} />
				<div className="grid min-w-0 grid-cols-1 gap-6">
					<EventsPanel events={events} names={eventNames} onClear={clear} />
					<HtmlPanel entry={entry} html={html} />
				</div>
			</div>

			<section aria-labelledby="about-title" className="mt-12 max-w-3xl">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<h2 id="about-title" className="text-lg font-semibold tracking-tight">About {component.title}</h2>
					<a href={entryPath(entry.id)} className="inline-flex items-center gap-1 text-sm font-medium text-secondary-800 hover:underline">
						Guide and API reference
						<Icon name="arrow_forward" size={16} />
					</a>
				</div>
				{component.description ? <Markdown source={component.description} /> : <p className="mt-3 text-sm text-neutral-920">{entry.summary}</p>}
			</section>
		</>
	);
}
