export type Block =
	| { type: 'heading'; level: number; text: string }
	| { type: 'paragraph'; text: string }
	| { type: 'label'; text: string }
	| { type: 'list'; items: string[] }
	| { type: 'code'; lang: string; code: string };

const FENCE = /^\s*```(\w*)/;
const HEADING = /^(#{1,6})\s+(.+)$/;
const LIST_ITEM = /^\s*[*-]\s+(.+)$/;

/** Short `Example usage:` style lines that introduce a code block */
const isLabel = (text: string) => text.endsWith(':') && text.length <= 48 && !text.includes('`');

/**
 * Block-level parser for the subset of markdown used in js-utils doc comments:
 * headings, paragraphs, `*`/`-` lists and fenced code blocks.
 */
export function parseBlocks(markdown: string): Block[] {
	const blocks: Block[] = [];
	const lines = markdown.split('\n');
	let paragraph: string[] = [];

	const flushParagraph = () => {
		const text = paragraph.join(' ').replace(/\s+/g, ' ').trim();
		if (text) blocks.push(isLabel(text) ? { type: 'label', text } : { type: 'paragraph', text });
		paragraph = [];
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const fence = line.match(FENCE);

		if (fence) {
			flushParagraph();
			const code: string[] = [];
			while (++i < lines.length && !FENCE.test(lines[i])) code.push(lines[i]);
			blocks.push({ type: 'code', lang: fence[1] || 'text', code: code.join('\n').replace(/\s+$/, '') });
			continue;
		}

		const heading = line.match(HEADING);
		if (heading) {
			flushParagraph();
			blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() });
			continue;
		}

		const item = line.match(LIST_ITEM);
		if (item) {
			flushParagraph();
			const last = blocks[blocks.length - 1];
			if (last?.type === 'list') last.items.push(item[1]);
			else blocks.push({ type: 'list', items: [item[1]] });
			continue;
		}

		if (!line.trim()) flushParagraph();
		else paragraph.push(line);
	}

	flushParagraph();
	return blocks;
}
