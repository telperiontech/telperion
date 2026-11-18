import type { KeyboardEvent } from 'react';
import { useDiagram } from './diagram-context';
import { GUTTER } from '../model/geometry';

const ADD_RADIUS = 9;

/** The time axis of a lane, with its arrowhead; `solid` limits the solid stretch (e.g. a subscription) */
export function LaneAxis({ y, solid }: { y: number; solid?: { from: number; to?: number } }) {
	const { scale } = useDiagram();
	// A subscription from frame 0 owns the whole axis, including the margin before frame 0
	const from = solid && solid.from > 0 ? scale.x(solid.from) : scale.axisStart;
	const to = solid?.to !== undefined ? scale.x(solid.to) : scale.axisEnd;

	return (
		<g>
			{solid && <line x1={scale.axisStart} x2={scale.axisEnd} y1={y} y2={y} strokeWidth={1.5} strokeDasharray="3 5" className="stroke-neutral-200" />}
			<line x1={from} x2={to} y1={y} y2={y} strokeWidth={1.5} className="stroke-neutral-550" />
			<path d={`M ${scale.axisEnd + 8} ${y} l -9 -5 v 10 z`} className={solid?.to !== undefined ? 'fill-neutral-200' : 'fill-neutral-550'} />
		</g>
	);
}

/** Lane name in the gutter, with an add button for editable inputs */
export function LaneCaption({ label, y, onAdd }: { label: string; y: number; onAdd?: () => void }) {
	const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
		if (event.key !== 'Enter' && event.key !== ' ') return;

		event.preventDefault();
		onAdd?.();
	};

	return (
		<g>
			<text x={0} y={y} dominantBaseline="central" className="fill-neutral-920 text-[12px] font-medium">{label}</text>
			{onAdd && (
				<g role="button" tabIndex={0} aria-label={`Add a value to ${label}`} className="group cursor-pointer outline-none" onClick={onAdd} onKeyDown={onKeyDown}>
					<title>{`Add a value to ${label}`}</title>
					<circle
						cx={GUTTER - 16}
						cy={y}
						r={ADD_RADIUS}
						strokeWidth={1.25}
						className="fill-white stroke-neutral-250 group-hover:fill-secondary-50 group-hover:stroke-secondary-500 group-focus-visible:stroke-secondary-600 group-focus-visible:stroke-2"
					/>
					<path d={`M ${GUTTER - 20} ${y} h 8 M ${GUTTER - 16} ${y - 4} v 8`} strokeWidth={1.5} strokeLinecap="round" className="pointer-events-none stroke-neutral-920" />
				</g>
			)}
		</g>
	);
}
