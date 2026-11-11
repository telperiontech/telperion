const ENTITIES: Record<string, string> = {
	mdash: '—',
	ndash: '–',
	hellip: '…',
	middot: '·',
	nbsp: ' ',
	rarr: '→',
	larr: '←',
	times: '×',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	amp: '&',
};

/** Decodes the named and numeric HTML entities doc comments and READMEs use */
export function decodeEntities(text: string): string {
	return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
		if (entity.startsWith('#x') || entity.startsWith('#X')) return String.fromCodePoint(parseInt(entity.slice(2), 16));

		if (entity.startsWith('#')) return String.fromCodePoint(parseInt(entity.slice(1), 10));

		return ENTITIES[entity.toLowerCase()] ?? match;
	});
}

/** Normalizes manifest / README text: LF line endings, decoded entities, `{@link X}` as code */
export function cleanText(text: string | undefined): string {
	if (!text) return '';

	return decodeEntities(text.replace(/\r\n?/g, '\n'))
		.replace(/\{@link\s+([^}\s|]+)(?:\s*\|\s*([^}]+))?\}/g, (_, target: string, label?: string) => `\`${(label ?? target).trim()}\``)
		.trim();
}

/** First prose paragraph, skipping headings and code, flattened to one line */
export function firstParagraph(markdown: string): string {
	return (
		markdown
			.split(/\n\s*\n/)
			.map((block) => block.trim())
			.find((block) => block && !block.startsWith('#') && !block.startsWith('```') && !block.startsWith('|') && !block.startsWith('-'))
			?.replace(/\s+/g, ' ') ?? ''
	);
}

/** `drag-drop` → `Drag Drop` */
export const titleFromId = (id: string) => id.replace(/(^|-)([a-z])/g, (_, separator: string, char: string) => `${separator ? ' ' : ''}${char.toUpperCase()}`);
