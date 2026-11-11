let context: CanvasRenderingContext2D | null | undefined;
const hex2 = (value: number) => Math.round(value).toString(16).padStart(2, '0');

/**
 * Normalizes any CSS color (`red`, `rgba(…)`, `#abc`) to `#rrggbb` for `<input type="color">`,
 * which only accepts that form. Alpha is dropped; `undefined` when the value is not a color.
 */
export function toHex(value: string): string | undefined {
	context ??= document.createElement('canvas').getContext('2d');

	if (!context) return undefined;

	context.fillStyle = '#000000';
	context.fillStyle = value;

	const normalized = context.fillStyle;

	if (normalized.startsWith('#')) return normalized;

	const channels = normalized.match(/[\d.]+/g)?.map(Number);

	return channels && channels.length >= 3 ? `#${channels.slice(0, 3).map(hex2).join('')}` : undefined;
}
