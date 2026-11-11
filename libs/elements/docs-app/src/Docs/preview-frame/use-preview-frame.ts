import { useEffect, useRef, useState, type RefObject } from 'react';
import { isPreviewMessage, type ArgValue, type EventMessage, type RenderMessage } from '../../protocol/messages';
import { previewUrl } from './preview-url';

export interface PreviewRequest {
	componentId: string;
	storyId: string;
	/** Overrides of the story's default args */
	args: Record<string, ArgValue>;
	events: readonly string[];
}

interface PreviewFrameState {
	frame: RefObject<HTMLIFrameElement>;
	src: string;
	/** Content height reported by the preview, `undefined` until the first render */
	height?: number;
	error?: string;
}

/**
 * Drives a `preview.html` iframe: waits for it to be ready, (re)sends the render request
 * whenever it changes, and collects size, event and error messages.
 */
export function usePreviewFrame(request: PreviewRequest, onEvent?: (event: EventMessage) => void): PreviewFrameState {
	const frame = useRef<HTMLIFrameElement>(null);
	const [src] = useState(previewUrl);
	const [ready, setReady] = useState(false);
	const [height, setHeight] = useState<number>();
	const [error, setError] = useState<string>();
	const onEventRef = useRef(onEvent);

	onEventRef.current = onEvent;

	useEffect(() => {
		const listener = (event: MessageEvent) => {
			if (event.source !== frame.current?.contentWindow || !isPreviewMessage(event.data)) return;

			const message = event.data;

			switch (message.type) {
				case 'osw-preview:ready':
					setReady(true);
					break;
				case 'osw-preview:size':
					setHeight(message.height);
					break;
				case 'osw-preview:event':
					onEventRef.current?.(message);
					break;
				case 'osw-preview:error':
					setError(message.message);
					break;
			}
		};

		window.addEventListener('message', listener);

		return () => window.removeEventListener('message', listener);
	}, []);

	// Serialized so a new-but-equal request object does not re-render the story
	const serialized = JSON.stringify(request);

	useEffect(() => {
		if (!ready) return;

		const message: RenderMessage = { type: 'osw-preview:render', ...(JSON.parse(serialized) as PreviewRequest), events: [...request.events] };

		setError(undefined);
		frame.current?.contentWindow?.postMessage(message, new URL(src).origin);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ready, serialized, src]);

	return { frame, src, height, error };
}
