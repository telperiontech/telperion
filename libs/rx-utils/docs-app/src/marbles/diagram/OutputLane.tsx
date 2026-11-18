import { useDiagram } from './diagram-context';
import { DraggableMark } from './DraggableMark';
import type { DiagramEditor } from './editor';
import { LaneAxis, LaneCaption } from './LaneChrome';
import { TerminalGlyph } from './TerminalGlyph';
import { ValueGlyph } from './ValueGlyph';
import type { WindowEdge } from '../model/edit';
import { MARBLE_RADIUS } from '../model/geometry';
import { placeEvents } from '../model/placement';
import type { OutputRow } from '../model/rows';

const KNOB = 5;

/** A subscriber's subscribe (round knob) or unsubscribe (square knob) point */
function SubscriptionHandle({ x, y, edge }: { x: number; y: number; edge: WindowEdge }) {
	const top = y - MARBLE_RADIUS - 10;

	return (
		<g className="fill-secondary-600 stroke-secondary-600">
			<line x1={x} x2={x} y1={top} y2={y + MARBLE_RADIUS + 2} strokeWidth={2} />
			{edge === 'subscribe' ? <circle cx={x} cy={top} r={KNOB} /> : <rect x={x - KNOB} y={top - KNOB} width={KNOB * 2} height={KNOB * 2} rx={1.5} />}
		</g>
	);
}

/** What one subscriber receives; revealed as the playhead passes */
export function OutputLane({ row, editor }: { row: OutputRow; editor?: DiagramEditor }) {
	const { scale, time } = useDiagram();
	const placed = placeEvents(row.events, scale, row.format);
	const handles: WindowEdge[] = row.movable && editor ? (row.window.unsubscribe === undefined ? ['subscribe'] : ['subscribe', 'unsubscribe']) : [];

	return (
		<g>
			<LaneCaption label={row.label} y={row.y} />
			<LaneAxis y={row.y} solid={{ from: row.window.subscribe, to: row.window.unsubscribe }} />
			{/* Handles first, so a value emitted on subscription draws over the handle's stem */}
			{handles.map((edge) => {
				const frame = edge === 'subscribe' ? row.window.subscribe : (row.window.unsubscribe ?? 0);
				const x = scale.x(frame);

				return (
					<DraggableMark
						key={edge}
						frame={frame}
						label={`${row.label} ${edge}s`}
						ring={{ x: x - 8, y: row.y - MARBLE_RADIUS - 16, width: 16, height: MARBLE_RADIUS * 2 + 20 }}
						onFrame={(target) => editor?.moveWindow(row.index, edge, target)}
					>
						<SubscriptionHandle x={x} y={row.y} edge={edge} />
					</DraggableMark>
				);
			})}
			{placed.map(({ event, x, width, shape, label, fullLabel }, index) => (
				<g key={index} opacity={event.frame > time ? 0 : 1} className="pointer-events-none transition-opacity duration-150">
					{event.kind === 'next' ? (
						<ValueGlyph value={event.value} shape={shape} label={label} fullLabel={fullLabel} x={x} y={row.y} width={width} />
					) : (
						<TerminalGlyph kind={event.kind} x={x} y={row.y} />
					)}
				</g>
			))}
		</g>
	);
}
