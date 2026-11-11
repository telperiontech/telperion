import { useEffect, useLayoutEffect, useRef } from 'react';
import { clearStory, renderStory, type Args, type StoryDoc } from '../core';
import { useFitZoom, type FitOptions } from './use-fit-zoom';

interface StoryCanvasProps {
	story: StoryDoc;
	args: Args;
	/** Called with the rendered container after every render, e.g. to extract a snippet from it */
	onRender?: (container: HTMLElement) => void;
	fit?: FitOptions;
	/** Shows the zoom level when the story is scaled down */
	showZoom?: boolean;
	className?: string;
}

/** Renders a story with lit into a React-owned stage, scaled down to fit it */
export function StoryCanvas({ story, args, onRender, fit, showZoom = false, className = '' }: StoryCanvasProps) {
	const stage = useRef<HTMLDivElement>(null);
	const content = useRef<HTMLDivElement>(null);
	// A ref keeps inline callbacks from re-rendering the story on every parent render
	const onRenderRef = useRef(onRender);
	const zoom = useFitZoom(stage, content, fit);

	onRenderRef.current = onRender;

	useLayoutEffect(() => {
		const container = content.current;

		if (!container) return;
		renderStory(story, args, container);
		onRenderRef.current?.(container);
	}, [story, args]);

	useEffect(() => {
		const container = content.current;

		return () => {
			if (container) clearStory(container);
		};
	}, []);

	return (
		<div ref={stage} className={`relative flex items-center justify-center overflow-hidden ${className}`}>
			<div ref={content} className="w-max" style={{ zoom }} />
			{showZoom && zoom < 1 && <ZoomBadge zoom={zoom} />}
		</div>
	);
}

export function ZoomBadge({ zoom }: { zoom: number }) {
	return (
		<span className="absolute right-3 bottom-3 rounded-full bg-white/80 px-2 py-0.5 font-mono text-[11px] text-neutral-850 backdrop-blur">
			{Math.round(zoom * 100)}%
		</span>
	);
}
