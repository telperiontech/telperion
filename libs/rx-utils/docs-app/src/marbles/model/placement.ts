import type { LaneEvent } from '../engine';
import { formatValue, isMarbleArray } from './format';
import { arrayPillWidth, CIRCLE_LABEL_MAX, MARBLE_RADIUS, pillWidth, type TimeScale } from './geometry';

/** How a value is drawn: a marble, a text pill, or a pill of small marbles (arrays) */
export type GlyphShape = 'circle' | 'pill' | 'array';

export interface PlacedEvent<E extends LaneEvent> {
	event: E;
	/** Center of the glyph */
	x: number;
	width: number;
	shape: GlyphShape;
	/** Text drawn on the glyph, shortened to fit */
	label: string;
	/** Untruncated label, for the tooltip and accessible name */
	fullLabel: string;
}

const TERMINAL_WIDTH = 6;
const GAP = 4;
/** Longer labels are cut, so neighbouring pills keep apart */
const MAX_LABEL = 16;
const truncate = (label: string) => (label.length > MAX_LABEL ? `${label.slice(0, MAX_LABEL - 1)}…` : label);

/** A lane with its own `format` always gets text; otherwise arrays of primitives get small marbles */
function shapeOf(value: unknown, label: string, format: (value: unknown) => string): GlyphShape {
	if (format === formatValue && isMarbleArray(value)) return 'array';

	return label.length <= CIRCLE_LABEL_MAX ? 'circle' : 'pill';
}

function widthOf(event: LaneEvent, shape: GlyphShape, label: string): number {
	if (event.kind !== 'next') return TERMINAL_WIDTH;

	if (shape === 'array') return arrayPillWidth((event.value as unknown[]).length);

	return shape === 'circle' ? MARBLE_RADIUS * 2 : pillWidth(label);
}

/**
 * Positions a lane's glyphs: each at its frame, and events of the same frame side by side
 * (the way `(ab|)` reads), the first one centered on the frame.
 */
export function placeEvents<E extends LaneEvent>(events: readonly E[], scale: TimeScale, format: (value: unknown) => string): PlacedEvent<E>[] {
	const placed: PlacedEvent<E>[] = [];

	for (const event of events) {
		const fullLabel = event.kind === 'next' ? format(event.value) : '';
		const label = truncate(fullLabel);
		const shape = event.kind === 'next' ? shapeOf(event.value, label, format) : 'circle';
		const width = widthOf(event, shape, label);
		const previous = placed[placed.length - 1];
		const x = previous && previous.event.frame === event.frame ? previous.x + previous.width / 2 + GAP + width / 2 : scale.x(event.frame);

		placed.push({ event, x, width, shape, label, fullLabel });
	}

	return placed;
}
