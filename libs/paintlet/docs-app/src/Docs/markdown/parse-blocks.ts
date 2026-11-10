export type Block =
	| { type: 'heading'; level: number; text: string }
	| { type: 'paragraph'; text: string }
	| { type: 'list'; items: string[] }
	| { type: 'table'; header: string[]; rows: string[][] }
	| { type: 'code'; lang: string; code: string };

const FENCE = /^\s*```(\w*)/;
const HEADING = /^\s*(#{1,6})\s+(.+)$/;
const LIST_ITEM = /^\s*[*-]\s+(.+)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEPARATOR = /^\s*\|(\s*:?-+:?\s*\|)+\s*$/;
const cellsOf = (row: string) =>
	row
		.trim()
		.replace(/^\||\|$/g, '')
		.split('|')
		.map((cell) => cell.trim());

function dedent(lines: string[]): string[] {
	const indent = Math.min(...lines.filter((line) => line.trim()).map((line) => line.match(/^\s*/)?.[0].length ?? 0));

	return lines.map((line) => line.slice(Number.isFinite(indent) ? indent : 0));
}

/**
 * Block-level parser for the markdown used in story descriptions:
 * headings, paragraphs, `*`/`-` lists, pipe tables and fenced code blocks.
 */
export function parseBlocks(markdown: string): Block[] {
	const blocks: Block[] = [];
	const lines = markdown.split('\n');
	let paragraph: string[] = [];
	const flushParagraph = () => {
		const text = paragraph.join(' ').replace(/\s+/g, ' ').trim();

		if (text) blocks.push({ type: 'paragraph', text });
		paragraph = [];
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const fence = line.match(FENCE);

		if (fence) {
			flushParagraph();

			const code: string[] = [];

			while (++i < lines.length && !FENCE.test(lines[i])) code.push(lines[i]);
			blocks.push({ type: 'code', lang: fence[1] || 'text', code: dedent(code).join('\n').replace(/\s+$/, '') });

			continue;
		}

		if (TABLE_ROW.test(line)) {
			flushParagraph();

			const rows: string[][] = [];

			for (; i < lines.length && TABLE_ROW.test(lines[i]); i++) {
				if (!TABLE_SEPARATOR.test(lines[i])) rows.push(cellsOf(lines[i]));
			}
			i--;

			const [header = [], ...body] = rows;
			blocks.push({ type: 'table', header, rows: body });

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
