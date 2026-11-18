export interface MarbleColor {
	fill: string;
	stroke: string;
}

/** Full class names, so Tailwind generates them */
const PALETTE: MarbleColor[] = [
	{ fill: 'fill-primary-200', stroke: 'stroke-primary-700' },
	{ fill: 'fill-tertiary-200', stroke: 'stroke-tertiary-700' },
	{ fill: 'fill-quaternary-200', stroke: 'stroke-quaternary-700' },
	{ fill: 'fill-secondary-200', stroke: 'stroke-secondary-700' },
	{ fill: 'fill-success-200', stroke: 'stroke-success-700' },
	{ fill: 'fill-danger-200', stroke: 'stroke-danger-700' },
	{ fill: 'fill-warning-200', stroke: 'stroke-warning-700' },
];

export const NEUTRAL: MarbleColor = { fill: 'fill-white', stroke: 'stroke-neutral-400' };

const keyOf = (value: unknown) => (value !== null && typeof value === 'object' ? JSON.stringify(value) : `${typeof value}:${String(value)}`);
const contains = (container: unknown, value: unknown): boolean =>
	container !== null && typeof container === 'object' && Object.values(container).some((item) => item === value || contains(item, value));

export type Colorer = (value: unknown) => MarbleColor;

/**
 * Colors input values in order of appearance. Output values keep the color of the input they
 * came from: an equal value, or else the input object or array that contains it.
 */
export function createColorer(inputValues: readonly unknown[]): Colorer {
	const known = new Map<string, MarbleColor>();
	const containers: [unknown, MarbleColor][] = [];

	for (const value of inputValues) {
		const key = keyOf(value);

		if (known.has(key)) continue;

		const color = PALETTE[known.size % PALETTE.length];

		known.set(key, color);

		if (value !== null && typeof value === 'object') containers.push([value, color]);
	}

	return (value) => known.get(keyOf(value)) ?? containers.find(([container]) => contains(container, value))?.[1] ?? NEUTRAL;
}
