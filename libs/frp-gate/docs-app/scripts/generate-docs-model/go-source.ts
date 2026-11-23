import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Just enough Go reading for the docs: doc comments, function bodies and struct bodies,
 * found by text. The sources are gofmt-formatted, which keeps the patterns simple.
 */

export interface GoPackage {
	/** Package folder, relative to the library root */
	dir: string;
	/** All non-test `.go` files of the package, concatenated */
	source: string;
}

export function readPackage(libRoot: string, dir: string): GoPackage {
	const files = readdirSync(join(libRoot, dir))
		.filter((file) => file.endsWith('.go') && !file.endsWith('_test.go'))
		.sort();

	return { dir, source: files.map((file) => readFileSync(join(libRoot, dir, file), 'utf8')).join('\n') };
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Index of the `{` that opens a function or a type's body */
function declarationStart(source: string, declaration: RegExp): number | undefined {
	const match = declaration.exec(source);

	return match ? match.index : undefined;
}

const funcPattern = (name: string) => new RegExp(`^func (?:\\([^)]*\\) )?${escape(name)}\\(`, 'm');
const typePattern = (name: string) => new RegExp(`^type ${escape(name)} `, 'm');

/** The `//` lines right above the declaration at `index`, without the slashes */
function commentAbove(source: string, index: number): string[] {
	const lines = source.slice(0, index).split('\n');
	const comment: string[] = [];

	// The last element is the (empty) start of the declaration's own line
	for (let i = lines.length - 2; i >= 0 && /^\s*\/\//.test(lines[i]); i--) {
		comment.unshift(lines[i].replace(/^\s*\/\/ ?/, ''));
	}

	return comment;
}

export const funcDoc = (pkg: GoPackage, name: string) => docOf(pkg, funcPattern(name));
export const typeDoc = (pkg: GoPackage, name: string) => docOf(pkg, typePattern(name));

function docOf(pkg: GoPackage, declaration: RegExp): string[] | undefined {
	const index = declarationStart(pkg.source, declaration);

	return index === undefined ? undefined : commentAbove(pkg.source, index);
}

/** The text between the braces that open after `from`, skipping Go string literals */
function braced(source: string, from: number): string | undefined {
	const open = source.indexOf('{', from);

	if (open < 0) return undefined;

	let depth = 0;

	for (let i = open; i < source.length; i++) {
		const char = source[i];

		if (char === '"' || char === '`') {
			const end = char === '"' ? /(?<!\\)"/g : /`/g;

			end.lastIndex = i + 1;
			i = end.exec(source)?.index ?? source.length;
		} else if (char === '{') {
			depth++;
		} else if (char === '}' && --depth === 0) {
			return source.slice(open + 1, i);
		}
	}

	return undefined;
}

export function funcBody(pkg: GoPackage, name: string): string | undefined {
	const index = declarationStart(pkg.source, funcPattern(name));

	return index === undefined ? undefined : braced(pkg.source, pkg.source.indexOf(')', index));
}

export function structBody(pkg: GoPackage, name: string): string | undefined {
	const match = new RegExp(`^type ${escape(name)} struct \\{`, 'm').exec(pkg.source);

	return match ? braced(pkg.source, match.index) : undefined;
}

/** The text of the braces opening at `from` in `source` (a composite literal, a struct) */
export const bracedAt = braced;

/**
 * A doc comment as markdown: paragraphs are joined, tab-indented lines become a code block.
 * `name` drops the declaration's own name from the first sentence (`apiZones lists` → `Lists`).
 */
export function docMarkdown(lines: string[], { name, codeLanguage = 'text' }: { name?: string; codeLanguage?: string } = {}): string {
	const blocks: string[] = [];
	let paragraph: string[] = [];
	let code: string[] = [];
	const flush = () => {
		if (paragraph.length) blocks.push(paragraph.join(' '));

		if (code.length) blocks.push(['```' + codeLanguage, ...code, '```'].join('\n'));
		paragraph = [];
		code = [];
	};

	for (const line of lines) {
		if (line.startsWith('\t')) {
			if (paragraph.length) flush();
			code.push(line.slice(1));
		} else if (!line.trim()) {
			flush();
		} else {
			if (code.length) flush();
			paragraph.push(line.trim());
		}
	}
	flush();

	const text = blocks.join('\n\n');

	return name ? withoutName(text, name) : text;
}

/** `apiZones lists the zones.` → `Lists the zones.`; `X is used by` → `Used by` */
function withoutName(text: string, name: string): string {
	const rest = text.replace(new RegExp(`^${escape(name)}(?::| is | )\\s*`), '');

	if (rest === text) return text;

	return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** Every `"…"` string literal in `source` */
export const stringLiterals = (source: string) => [...source.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((match) => match[1]);
