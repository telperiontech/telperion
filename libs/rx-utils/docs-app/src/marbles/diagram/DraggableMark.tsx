import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { useDiagram } from './diagram-context';

interface DraggableMarkProps {
	frame: number;
	/** Accessible name, e.g. `value a on source` */
	label: string;
	/** Bounds of the focus ring */
	ring: { x: number; y: number; width: number; height: number };
	onFrame: (frame: number) => void;
	onRemove?: () => void;
	children: ReactNode;
}

/** Something on the timeline that moves with the pointer or the arrow keys, and can be removed */
export function DraggableMark({ frame, label, ring, onFrame, onRemove, children }: DraggableMarkProps) {
	const { toFrame } = useDiagram();
	const dragging = useRef(false);
	const onPointerDown = (event: PointerEvent<SVGGElement>) => {
		if (event.button !== 0) return;

		event.currentTarget.setPointerCapture(event.pointerId);
		dragging.current = true;
	};
	const onPointerMove = (event: PointerEvent<SVGGElement>) => {
		if (dragging.current) onFrame(toFrame(event.clientX));
	};
	const endDrag = (event: PointerEvent<SVGGElement>) => {
		dragging.current = false;

		if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
	};
	const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
		const step = event.shiftKey ? 5 : 1;

		if (event.key === 'ArrowLeft') onFrame(frame - step);
		else if (event.key === 'ArrowRight') onFrame(frame + step);
		else if ((event.key === 'Delete' || event.key === 'Backspace') && onRemove) onRemove();
		else return;

		event.preventDefault();
	};

	return (
		<g
			role="button"
			tabIndex={0}
			aria-label={`${label}, frame ${frame}`}
			aria-keyshortcuts={onRemove ? 'ArrowLeft ArrowRight Delete' : 'ArrowLeft ArrowRight'}
			className="group cursor-grab touch-none outline-none active:cursor-grabbing"
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={endDrag}
			onPointerCancel={endDrag}
			onDoubleClick={(event) => {
				event.stopPropagation();
				onRemove?.();
			}}
			onKeyDown={onKeyDown}
		>
			<rect
				x={ring.x - 4}
				y={ring.y - 4}
				width={ring.width + 8}
				height={ring.height + 8}
				rx={(ring.height + 8) / 2}
				fill="none"
				strokeWidth={2}
				className="stroke-secondary-500 opacity-0 group-focus-visible:opacity-100"
			/>
			{children}
		</g>
	);
}
