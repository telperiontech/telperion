import { useCallback, useState } from 'react';
import { Markdown, SidebarLayout } from '@osw/docs';
import { ControlsPanel, StoryCanvas, StoryHeader, StorySidebar, useStoryArgs, type ComponentDoc, type StoryDoc } from '@osw/stories';
import { paintletPath, storyPath } from '../routing';
import { extractCss, SnippetPanel } from '../snippet';
import { paintlets } from '../stories';
import { SupportNotice } from '../support';

interface PlaygroundPageProps {
	paintlet: ComponentDoc;
	story: StoryDoc;
}

/** Tallest the preview gets before the story is scaled down */
const STAGE_MAX_HEIGHT = 560;

export function PlaygroundPage({ paintlet, story }: PlaygroundPageProps) {
	const { args, update, reset, changed } = useStoryArgs(story);
	const [css, setCss] = useState('');
	const onRender = useCallback((container: HTMLElement) => setCss(extractCss(container)), []);

	return (
		<SidebarLayout
			menuLabel="Browse paintlets"
			sidebar={(onNavigate) => (
				<StorySidebar
					components={paintlets}
					label="Paintlets"
					componentHref={paintletPath}
					storyHref={storyPath}
					activeComponentId={paintlet.id}
					activeStoryId={story.id}
					onNavigate={onNavigate}
				/>
			)}
		>
			<StoryHeader component={paintlet} story={story} args={args} />

			<SupportNotice className="mt-6" />

			<StoryCanvas
				story={story}
				args={args}
				onRender={onRender}
				fit={{ maxHeight: STAGE_MAX_HEIGHT }}
				showZoom
				className="mt-6 min-h-72 rounded-xl border border-neutral-100 bg-neutral-20 bg-[radial-gradient(var(--color-neutral-100)_1px,transparent_1px)] bg-size-[16px_16px] p-6"
			/>

			<div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
				<ControlsPanel story={story} args={args} changed={changed} onChange={update} onReset={reset} />
				<SnippetPanel css={css} />
			</div>

			{paintlet.description && (
				<section aria-labelledby="about-title" className="mt-12 max-w-3xl">
					<h2 id="about-title" className="text-lg font-semibold tracking-tight">About {paintlet.title}</h2>
					<Markdown source={paintlet.description} skipIntro />
				</section>
			)}
		</SidebarLayout>
	);
}
