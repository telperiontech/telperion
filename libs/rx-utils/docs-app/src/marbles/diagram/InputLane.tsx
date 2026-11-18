import { useDiagram } from './diagram-context';
import { DraggableMark } from './DraggableMark';
import type { DiagramEditor } from './editor';
import { LaneAxis, LaneCaption } from './LaneChrome';
import { SubscriptionBands } from './SubscriptionBands';
import { TerminalGlyph } from './TerminalGlyph';
import { ValueGlyph } from './ValueGlyph';
import { LANE_HEIGHT, MARBLE_RADIUS } from '../model/geometry';
import { placeEvents } from '../model/placement';
import type { InputRow } from '../model/rows';

/** Opacity of input events the playhead has not reached yet */
const UPCOMING = 0.3;

/** A source lane: always fully drawn, its marbles draggable when there is an editor */
export function InputLane({ row, editor }: { row: InputRow; editor?: DiagramEditor }) {
	const { scale, time, toFrame } = useDiagram();
	const placed = placeEvents(row.events, scale, row.format);

	return (
		<g>
			<LaneCaption label={row.label} y={row.y} onAdd={editor && (() => editor.addValue(row.name))} />
			<LaneAxis y={row.y} />
			<SubscriptionBands windows={row.subscriptions} y={row.y} />
			{editor && (
				<rect
					x={scale.axisStart}
					y={row.y - LANE_HEIGHT / 2}
					width={scale.axisEnd - scale.axisStart}
					height={LANE_HEIGHT}
					fill="transparent"
					onDoubleClick={(event) => editor.addValue(row.name, toFrame(event.clientX))}
				/>
			)}
			{placed.map(({ event, x, width, shape, label, fullLabel }) => {
				const glyph = (
					<g opacity={event.frame > time ? UPCOMING : 1} className="transition-opacity duration-150">
						{event.kind === 'next' ? (
							<ValueGlyph value={event.value} shape={shape} label={label} fullLabel={fullLabel} x={x} y={row.y} width={width} />
						) : (
							<TerminalGlyph kind={event.kind} x={x} y={row.y} />
						)}
					</g>
				);

				if (!editor) return <g key={event.id}>{glyph}</g>;

				const name = event.kind === 'next' ? `Value ${fullLabel} on ${row.label}` : `${event.kind === 'complete' ? 'Completion' : 'Error'} of ${row.label}`;
				const ringWidth = event.kind === 'next' ? width : 12;

				return (
					<DraggableMark
						key={event.id}
						frame={event.frame}
						label={name}
						ring={{ x: x - ringWidth / 2, y: row.y - MARBLE_RADIUS, width: ringWidth, height: MARBLE_RADIUS * 2 }}
						onFrame={(frame) => editor.moveEvent(row.name, event.id, frame)}
						onRemove={() => editor.removeEvent(row.name, event.id)}
					>
						{glyph}
					</DraggableMark>
				);
			})}
		</g>
	);
}
