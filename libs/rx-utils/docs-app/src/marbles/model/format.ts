/** Default marble label: short and JSON-like, strings unquoted so single letters read as marbles */
export function formatValue(value: unknown): string {
	if (typeof value === 'string') return value;

	if (Array.isArray(value)) return `[${value.map(formatValue).join(', ')}]`;

	if (value && typeof value === 'object') {
		return `{${Object.entries(value)
			.map(([key, item]) => `${key}: ${formatValue(item)}`)
			.join(', ')}}`;
	}

	return String(value);
}

/** Values drawn as a pill of small marbles: arrays of primitives, e.g. a buffered burst */
export function isMarbleArray(value: unknown): value is unknown[] {
	return Array.isArray(value) && value.every((item) => item === null || typeof item !== 'object');
}
