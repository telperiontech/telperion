/** `HeavyRain` → `Heavy Rain`, `PALGradient` → `PAL Gradient` (Storybook's default story naming) */
export function storyNameFromExport(exportName: string): string {
	return exportName
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
		.replace(/[_-]+/g, ' ')
		.trim();
}

/** `Heavy Rain` → `heavy-rain` */
export function toSlug(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/** Last segment of a CSF title: `Paintlets/Low Poly Mesh` → `Low Poly Mesh` */
export function titleLeaf(title: string): string {
	return title.split('/').pop()?.trim() ?? title;
}
