import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

export interface FitOptions {
	/** Height the content may take before it is scaled down; defaults to the stage's own height */
	maxHeight?: number;
}

const paddingOf = (element: HTMLElement) => {
	const style = getComputedStyle(element);

	return {
		x: parseFloat(style.paddingLeft) + parseFloat(style.paddingRight),
		y: parseFloat(style.paddingTop) + parseFloat(style.paddingBottom),
	};
};

/**
 * CSS `zoom` that scales `content` down (never up) to fit `stage`.
 * `zoom` rather than `transform` so paint worklets repaint at the scaled size and stay crisp.
 */
export function useFitZoom(stage: RefObject<HTMLElement | null>, content: RefObject<HTMLElement | null>, { maxHeight }: FitOptions = {}): number {
	const [zoom, setZoom] = useState(1);
	const zoomRef = useRef(1);

	useLayoutEffect(() => {
		const stageElement = stage.current;
		const contentElement = content.current;

		if (!stageElement || !contentElement) return;

		const update = () => {
			const rect = contentElement.getBoundingClientRect();
			// The rect is already zoomed; divide to get the story's own size
			const naturalWidth = rect.width / zoomRef.current;
			const naturalHeight = rect.height / zoomRef.current;

			if (!naturalWidth || !naturalHeight) return;

			const padding = paddingOf(stageElement);
			const availableWidth = stageElement.clientWidth - padding.x;
			const availableHeight = (maxHeight ?? stageElement.clientHeight) - padding.y;
			const next = Math.floor(Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight) * 100) / 100;

			if (next > 0 && next !== zoomRef.current) {
				zoomRef.current = next;
				setZoom(next);
			}
		};
		const observer = new ResizeObserver(update);
		observer.observe(stageElement);
		observer.observe(contentElement);
		update();

		return () => observer.disconnect();
	}, [stage, content, maxHeight]);

	return zoom;
}
