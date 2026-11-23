export interface MarbleColor {
	fill: string;
	stroke: string;
}

/** Full class names, so Tailwind generates them */
const PALETTE: MarbleColor[] = [
	{ fill: 'fill-primary-150', stroke: 'stroke-primary-600' },
	{ fill: 'fill-tertiary-160', stroke: 'stroke-tertiary-600' },
	{ fill: 'fill-quaternary-150', stroke: 'stroke-quaternary-600' },
	{ fill: 'fill-secondary-150', stroke: 'stroke-secondary-600' },
	{ fill: 'fill-success-150', stroke: 'stroke-success-600' },
	{ fill: 'fill-danger-150', stroke: 'stroke-danger-600' },
	{ fill: 'fill-warning-150', stroke: 'stroke-warning-600' },
];

/** Outline clears the WCAG 3:1 non-text minimum on the white page (neutral-450: 3.6:1) */
export const NEUTRAL: MarbleColor = { fill: 'fill-white', stroke: 'stroke-neutral-450' };

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
