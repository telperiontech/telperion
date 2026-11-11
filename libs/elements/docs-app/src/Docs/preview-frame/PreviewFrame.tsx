import { Icon } from '@osw/react';
import type { EventMessage } from '../../protocol/messages';
import { usePreviewFrame, type PreviewRequest } from './use-preview-frame';

interface PreviewFrameProps extends PreviewRequest {
	title: string;
	/** Height while loading, and the floor for short stories */
	minHeight?: number;
	/** Taller stories scroll inside the frame */
	maxHeight?: number;
	/** Fixed height (e.g. gallery tiles); disables auto-sizing */
	height?: number;
	onEvent?: (event: EventMessage) => void;
	className?: string;
}

/** A story rendered in the isolated `preview.html` iframe, sized to its content */
export function PreviewFrame({ title, minHeight = 160, maxHeight = 720, height, onEvent, className = '', ...request }: PreviewFrameProps) {
	const preview = usePreviewFrame(request, onEvent);
	const frameHeight = height ?? Math.min(maxHeight, Math.max(minHeight, preview.height ?? minHeight));

	return (
		<div className={`relative ${className}`}>
			<iframe
				ref={preview.frame}
				src={preview.src}
				title={title}
				loading="lazy"
				className="block w-full border-0 bg-transparent transition-[height] duration-150"
				style={{ height: frameHeight }}
			/>
			{preview.error && (
				<p role="alert" className="absolute inset-x-3 bottom-3 flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 p-3 text-xs text-danger-900">
					<Icon name="error" size={16} className="shrink-0" />
					{preview.error}
				</p>
			)}
		</div>
	);
}
