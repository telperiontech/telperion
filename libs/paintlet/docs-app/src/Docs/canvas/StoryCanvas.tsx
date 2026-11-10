import { useEffect, useLayoutEffect, useRef } from 'react';
import { extractCss } from '../snippet/extract-css';
import type { Args, StoryDoc } from '../stories';
import { clearStory, renderStory } from './render-story';
import { useFitZoom, type FitOptions } from './use-fit-zoom';

interface StoryCanvasProps {
	story: StoryDoc;
	args: Args;
	/** Receives the stylesheet behind every render, for the "Copy CSS" panel */
	onCss?: (css: string) => void;
	fit?: FitOptions;
	/** Shows the zoom level when the story is scaled down */
	showZoom?: boolean;
	className?: string;
}

/** Renders a story with lit into a React-owned stage, scaled down to fit it */
export function StoryCanvas({ story, args, onCss, fit, showZoom = false, className = '' }: StoryCanvasProps) {
	const stage = useRef<HTMLDivElement>(null);
	const content = useRef<HTMLDivElement>(null);
	const zoom = useFitZoom(stage, content, fit);

	useLayoutEffect(() => {
		const container = content.current;

		if (!container) return;
		renderStory(story, args, container);
		onCss?.(extractCss(container));
	}, [story, args, onCss]);

	useEffect(() => {
		const container = content.current;

		return () => {
			if (container) clearStory(container);
		};
	}, []);

	return (
		<div ref={stage} className={`relative flex items-center justify-center overflow-hidden ${className}`}>
			<div ref={content} className="w-max" style={{ zoom }} />
			{showZoom && zoom < 1 && (
				<span className="absolute right-3 bottom-3 rounded-full bg-white/80 px-2 py-0.5 font-mono text-[11px] text-neutral-850 backdrop-blur">
					{Math.round(zoom * 100)}%
				</span>
			)}
		</div>
	);
}
