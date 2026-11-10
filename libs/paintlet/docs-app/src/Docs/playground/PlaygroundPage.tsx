import { useState } from 'react';
import { CopyButton, Icon } from '@osw/react';
import { StoryCanvas } from '../canvas';
import { ControlsPanel } from '../controls';
import { Inline, Markdown } from '../markdown';
import { SnippetPanel } from '../snippet';
import { searchFromArgs, type PaintletDoc, type StoryDoc } from '../stories';
import { SupportNotice } from '../support';
import { StorySidebar } from './StorySidebar';
import { useStoryArgs } from './use-story-args';

interface PlaygroundPageProps {
	paintlet: PaintletDoc;
	story: StoryDoc;
}

/** Tallest the preview gets before the story is scaled down */
const STAGE_MAX_HEIGHT = 560;

export function PlaygroundPage({ paintlet, story }: PlaygroundPageProps) {
	const { args, update, reset, changed } = useStoryArgs(story);
	const [css, setCss] = useState('');
	const [menuOpen, setMenuOpen] = useState(false);
	// Built from args rather than location: the URL is synced after a short delay
	const shareUrl = `${window.location.origin}${window.location.pathname}${searchFromArgs(args, story.args)}`;

	return (
		<div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
			{/* Mobile: collapsible story list above the content */}
			<div className="pt-4 lg:hidden">
				<button
					type="button"
					onClick={() => setMenuOpen((open) => !open)}
					aria-expanded={menuOpen}
					className="flex w-full items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 text-sm font-medium"
				>
					Browse paintlets
					<span className={menuOpen ? 'hidden' : 'contents'}><Icon name="expand_more" size={18} /></span>
					<span className={menuOpen ? 'contents' : 'hidden'}><Icon name="expand_less" size={18} /></span>
				</button>
				{menuOpen && (
					<div className="mt-3 rounded-lg border border-neutral-100 p-3">
						<StorySidebar paintletId={paintlet.id} storyId={story.id} onNavigate={() => setMenuOpen(false)} />
					</div>
				)}
			</div>

			<aside className="hidden lg:block">
				<div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto py-8 pr-2">
					<StorySidebar paintletId={paintlet.id} storyId={story.id} />
				</div>
			</aside>

			<main className="min-w-0 py-8 lg:py-10">
				<header className="flex flex-wrap items-end justify-between gap-4">
					<div className="min-w-0">
						<p className="font-mono text-sm font-semibold text-secondary-700">{paintlet.title}</p>
						<h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{story.name}</h1>
						{(story.description ?? paintlet.summary) && (
							<p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-920">
								<Inline text={story.description ?? paintlet.summary ?? ''} />
							</p>
						)}
					</div>
					<div className="flex items-center gap-2 text-xs font-medium text-neutral-920">
						<span>Share this setup</span>
						<CopyButton text={shareUrl} />
					</div>
				</header>

				<SupportNotice className="mt-6" />

				<StoryCanvas
					story={story}
					args={args}
					onCss={setCss}
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
			</main>
		</div>
	);
}
