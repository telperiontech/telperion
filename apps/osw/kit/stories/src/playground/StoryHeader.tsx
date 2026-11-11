import { CopyButton } from '@osw/react';
import { Inline } from '@osw/docs';
import { searchFromArgs, type Args, type ComponentDoc, type StoryDoc } from '../core';

interface StoryHeaderProps {
	component: ComponentDoc;
	story: StoryDoc;
	args: Args;
}

/** Component name, story title and description, plus a link to the current setup */
export function StoryHeader({ component, story, args }: StoryHeaderProps) {
	// Built from args rather than location: the URL is synced after a short delay
	const shareUrl = `${window.location.origin}${window.location.pathname}${searchFromArgs(args, story.args)}`;
	const description = story.description ?? component.summary;

	return (
		<header className="flex flex-wrap items-end justify-between gap-4">
			<div className="min-w-0">
				<p className="font-mono text-sm font-semibold text-secondary-700">{component.title}</p>
				<h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{story.name}</h1>
				{description && (
					<p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-920">
						<Inline text={description} />
					</p>
				)}
			</div>
			<div className="flex items-center gap-2 text-xs font-medium text-neutral-920">
				<span>Share this setup</span>
				<CopyButton text={shareUrl} />
			</div>
		</header>
	);
}
