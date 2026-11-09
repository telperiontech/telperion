import * as ts from 'typescript';
import type { DocsTag } from '../../src/Docs/model/types';

export interface ParsedDoc {
	title?: string;
	summary: string;
	description: string;
	params: DocsTag[];
	templates: DocsTag[];
	returns?: string;
	see: string[];
}

const EMPTY_DOC: ParsedDoc = { summary: '', description: '', params: [], templates: [], see: [] };
const SEPARATOR = /^\s*(\* \* \*|\*\*\*|---)\s*$/;
const HEADING = /^#{1,6}\s+(.+)$/;
const FENCE = /^\s*```/;

/** Raw text of the last `/** ... *\/` comment directly above a node */
export function leadingJsDoc(node: ts.Node): string | undefined {
	const text = node.getSourceFile().getFullText();
	const ranges = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [];
	const doc = ranges.filter((range) => text.startsWith('/**', range.pos)).pop();
	return doc && text.slice(doc.pos, doc.end);
}

function commentLines(raw: string): string[] {
	return raw
		.replace(/^\/\*\*/, '')
		.replace(/\*\/$/, '')
		.split(/\r?\n/)
		.map((line) => line.replace(/^\s*\* ?/, '').replace(/\s+$/, ''));
}

/** Splits comment lines into body lines and `@tag` blocks, ignoring `@` inside code fences */
function splitTags(lines: string[]): { body: string[]; tags: string[] } {
	const body: string[] = [];
	const tags: string[] = [];
	let inFence = false;

	for (const line of lines) {
		if (FENCE.test(line)) inFence = !inFence;

		if (!inFence && /^@\w+/.test(line)) tags.push(line);
		else if (tags.length && !inFence && line.trim()) tags[tags.length - 1] += ` ${line.trim()}`;
		else if (!tags.length) body.push(line);
	}

	return { body, tags };
}

function parseTags(tags: string[]): Pick<ParsedDoc, 'params' | 'templates' | 'returns' | 'see'> {
	const result: Pick<ParsedDoc, 'params' | 'templates' | 'returns' | 'see'> = { params: [], templates: [], see: [] };

	for (const tag of tags) {
		const [, name, rest = ''] = tag.match(/^@(\w+)\s*([\s\S]*)$/) ?? [];
		const [, target = '', text = ''] = rest.match(/^(?:\{[^}]*\}\s*)?(\S+)\s*-?\s*([\s\S]*)$/) ?? [];

		if (name === 'param') result.params.push({ name: target, text });
		else if (name === 'template' || name === 'typeparam') result.templates.push({ name: target, text });
		else if (name === 'returns' || name === 'return') result.returns = rest;
		else if (name === 'see') result.see.push(rest);
	}

	return result;
}

/** First prose paragraph of the body: skips code blocks and `Example:` labels */
function firstParagraph(body: string[]): string {
	const paragraphs = body.join('\n').split(/\n\s*\n/);
	const prose = paragraphs.find((p) => p.trim() && !FENCE.test(p) && !/^[\w\s]*(example|usage)[\w\s]*:/i.test(p.trim()));
	return prose?.replace(/\s+/g, ' ').trim() ?? '';
}

function trimBlankLines(lines: string[]): string[] {
	const start = lines.findIndex((line) => line.trim());
	if (start === -1) return [];
	const end = lines.length - [...lines].reverse().findIndex((line) => line.trim());
	return lines.slice(start, end);
}

/** Parses the house TSDoc style: `#### Title`, prose, `* * *` separators, fenced examples, `@tags` */
export function parseJsDoc(raw: string | undefined): ParsedDoc {
	if (!raw) return EMPTY_DOC;

	const { body, tags } = splitTags(commentLines(raw));
	let inFence = false;

	const kept = trimBlankLines(
		body.filter((line) => {
			if (FENCE.test(line)) inFence = !inFence;
			return inFence || !SEPARATOR.test(line);
		}),
	);

	// A leading heading is the title; a sentence-long one ("#### Filters falsy values…") is really the summary
	const heading = kept[0]?.match(HEADING)?.[1].trim();
	let title: string | undefined;
	if (heading && heading.split(/\s+/).length <= 3) {
		title = heading;
		kept.shift();
	} else if (heading) {
		kept[0] = heading;
		kept.splice(1, 0, '');
	}

	const lines = trimBlankLines(kept);

	return { title, summary: firstParagraph(lines), description: lines.join('\n'), ...parseTags(tags) };
}
