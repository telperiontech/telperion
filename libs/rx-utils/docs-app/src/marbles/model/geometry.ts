/** Diagram coordinates (SVG viewBox units); the SVG scales to its container */
export const VIEW_WIDTH = 720;
/** Room for lane captions and the add buttons */
export const GUTTER = 124;
/** Room for the axis arrowheads */
export const RIGHT_PAD = 24;
/** Room for the playhead's time readout */
export const TOP_PAD = 26;
export const BOTTOM_PAD = 10;
export const LANE_HEIGHT = 58;
export const OPERATOR_HEIGHT = 46;
export const MARBLE_RADIUS = 13;
/** Radius of the small marbles inside an array pill */
export const DOT_RADIUS = 9;
export const DOT_GAP = 3;
/** Advance of one character at the 11px mono label size */
export const CHAR_WIDTH = 6.7;
/** Labels longer than this get a pill instead of a circle */
export const CIRCLE_LABEL_MAX = 2;

export interface TimeScale {
	/** Last frame on the axis */
	end: number;
	/** Width of one frame */
	step: number;
	x: (frame: number) => number;
	/** Nearest whole frame at an x position, clamped to the axis */
	frameAt: (x: number) => number;
	axisStart: number;
	axisEnd: number;
}

export function timeScale(end: number): TimeScale {
	const axisStart = GUTTER + 4;
	const axisEnd = VIEW_WIDTH - RIGHT_PAD;
	const first = axisStart + MARBLE_RADIUS + 6;
	const last = axisEnd - MARBLE_RADIUS - 8;
	const step = (last - first) / Math.max(end, 1);

	return {
		end,
		step,
		axisStart,
		axisEnd,
		x: (frame) => first + frame * step,
		frameAt: (x) => Math.min(end, Math.max(0, Math.round((x - first) / step))),
	};
}

/** Width of a text pill for a label */
export const pillWidth = (label: string) => Math.max(MARBLE_RADIUS * 2, label.length * CHAR_WIDTH + 16);

/** Width of an array pill holding `count` small marbles */
export const arrayPillWidth = (count: number) => Math.max(MARBLE_RADIUS * 2 + 8, count * (DOT_RADIUS * 2 + DOT_GAP) - DOT_GAP + 12);
