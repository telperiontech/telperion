/** One list item, with the bullets indented under it */
export interface ListItem {
	text: string;
	items: string[];
}

export type Block =
	| { type: 'heading'; level: number; text: string }
	| { type: 'paragraph'; text: string }
	| { type: 'label'; text: string }
	| { type: 'list'; ordered: boolean; items: ListItem[] }
	| { type: 'table'; header: string[]; rows: string[][] }
	| { type: 'code'; lang: string; code: string };

export interface ParseOptions {
	/** Turns short `Example usage:` style paragraphs into labels that introduce a code block */
	labels?: boolean;
}

const FENCE = /^\s*```(\w*)/;
const HEADING = /^\s*(#{1,6})\s+(.+)$/;
/** `- item`, `* item` or `1. item`; groups: indent, marker, text */
const LIST_ITEM = /^(\s*)([*-]|\d+\.)\s+(.+)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEPARATOR = /^\s*\|(\s*:?-+:?\s*\|)+\s*$/;
const cellsOf = (row: string) =>
	row
		.trim()
		.replace(/^\||\|$/g, '')
		.split('|')
		.map((cell) => cell.trim());
const isLabel = (text: string) => text.endsWith(':') && text.length <= 48 && !text.includes('`');

function dedent(lines: string[]): string[] {
	const indent = Math.min(...lines.filter((line) => line.trim()).map((line) => line.match(/^\s*/)?.[0].length ?? 0));

	return lines.map((line) => line.slice(Number.isFinite(indent) ? indent : 0));
}

const indentOf = (line: string) => line.match(/^\s*/)?.[0].length ?? 0;
const appendLine = (text: string, line: string) => `${text} ${line.trim()}`;

/**
 * Block-level parser for the markdown used in doc comments, story descriptions and READMEs:
 * headings, paragraphs, `*`/`-` and numbered lists (one nested level, wrapped lines),
 * pipe tables and fenced code blocks.
 */
export function parseBlocks(markdown: string, { labels = false }: ParseOptions = {}): Block[] {
	const blocks: Block[] = [];
	const lines = markdown.split('\n');
	let paragraph: string[] = [];
	/** The list being written: indented lines continue its last item, until a blank line */
	let list: { indent: number; nestedIndent: number; items: ListItem[] } | undefined;
	const flushParagraph = () => {
		const text = paragraph.join(' ').replace(/\s+/g, ' ').trim();

		if (text) blocks.push(labels && isLabel(text) ? { type: 'label', text } : { type: 'paragraph', text });
		paragraph = [];
	};
	const endBlock = () => {
		flushParagraph();
		list = undefined;
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const fence = line.match(FENCE);

		if (fence) {
			endBlock();

			const code: string[] = [];

			while (++i < lines.length && !FENCE.test(lines[i])) code.push(lines[i]);
			blocks.push({ type: 'code', lang: fence[1] || 'text', code: dedent(code).join('\n').replace(/\s+$/, '') });

			continue;
		}

		if (TABLE_ROW.test(line)) {
			endBlock();

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
			endBlock();
			blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() });

			continue;
		}

		const item = line.match(LIST_ITEM);

		if (item) {
			flushParagraph();

			const [, space, marker, text] = item;
			const indent = space.length;
			const ordered = /\d/.test(marker);
			const last = blocks[blocks.length - 1];
			const lastItem = list?.items[list.items.length - 1];

			if (list && lastItem && indent > list.indent) {
				lastItem.items.push(text);
				list.nestedIndent = indent;
			} else if (last?.type === 'list' && last.ordered === ordered) {
				last.items.push({ text, items: [] });
				list = { indent, nestedIndent: indent, items: last.items };
			} else {
				const items = [{ text, items: [] }];

				blocks.push({ type: 'list', ordered, items });
				list = { indent, nestedIndent: indent, items };
			}

			continue;
		}

		const lastItem = list?.items[list.items.length - 1];

		if (list && lastItem && line.trim() && indentOf(line) > list.indent) {
			const nested = lastItem.items.length - 1;

			if (nested >= 0 && indentOf(line) > list.nestedIndent) lastItem.items[nested] = appendLine(lastItem.items[nested], line);
			else lastItem.text = appendLine(lastItem.text, line);

			continue;
		}

		list = undefined;

		if (!line.trim()) flushParagraph();
		else paragraph.push(line);
	}

	flushParagraph();

	return blocks;
}
