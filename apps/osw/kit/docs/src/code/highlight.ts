export type TokenType = 'comment' | 'string' | 'keyword' | 'number' | 'type' | 'property' | 'function' | 'plain';
export type Language = 'ts' | 'css' | 'html' | 'shell';

export interface Token {
	type: TokenType;
	text: string;
}

const TS_KEYWORDS = [
	'import', 'from', 'export', 'const', 'let', 'var', 'function', 'return', 'async', 'await', 'new', 'class', 'extends',
	'interface', 'type', 'typeof', 'keyof', 'if', 'else', 'for', 'of', 'in', 'true', 'false', 'null', 'undefined',
	'this', 'static', 'readonly', 'get', 'set', 'void', 'any', 'unknown', 'never', 'string', 'number', 'boolean',
];

const GRAMMARS: Record<Language, [TokenType, string][]> = {
	ts: [
		['comment', String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/`],
		['string', String.raw`"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\x60(?:\\.|[^\x60\\])*\x60`],
		['keyword', String.raw`\b(?:${TS_KEYWORDS.join('|')})\b`],
		['number', String.raw`\b\d[\d_]*(?:\.\d+)?\b`],
		['type', String.raw`\b[A-Z][A-Za-z0-9_]*\b`],
	],
	css: [
		['comment', String.raw`\/\*[\s\S]*?\*\/`],
		['string', String.raw`"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'`],
		['keyword', String.raw`@[\w-]+`],
		['property', String.raw`(?<![\w-])-{0,2}[a-zA-Z][\w-]*(?=\s*:(?!:))`],
		['function', String.raw`-{0,2}[a-zA-Z][\w-]*(?=\()`],
		['type', String.raw`(?<![\w-])\.[a-zA-Z][\w-]*`],
		['number', String.raw`#[0-9a-fA-F]{3,8}\b|-?\b\d*\.?\d+(?:px|s|ms|%|deg|em|rem|vh|vw|fr)?\b`],
	],
	html: [
		['comment', String.raw`<!--[\s\S]*?-->`],
		['keyword', String.raw`<\/?[a-zA-Z][\w-]*|\/?>`],
		['string', String.raw`"[^"]*"|'[^']*'`],
		// Attribute names: only between a tag name and `>`, approximated by "followed by `=`, space, `/` or `>`"
		['property', String.raw`(?<=\s)[a-zA-Z_:@.?][\w:.-]*(?==)`],
	],
	shell: [
		['comment', String.raw`#[^\n]*`],
		['keyword', String.raw`^(?:npm|pnpm|yarn|npx)\b`],
	],
};

const MATCHERS = Object.fromEntries(
	Object.entries(GRAMMARS).map(([language, patterns]) => [language, new RegExp(patterns.map(([, source]) => `(${source})`).join('|'), 'gm')]),
) as Record<Language, RegExp>;

/** Tiny tokenizer for doc snippets; no dependencies, good enough for display */
export function highlight(code: string, language: Language = 'ts'): Token[] {
	const patterns = GRAMMARS[language];
	const tokens: Token[] = [];
	let last = 0;

	for (const match of code.matchAll(MATCHERS[language])) {
		const index = match.index ?? 0;

		if (index > last) tokens.push({ type: 'plain', text: code.slice(last, index) });

		const group = match.slice(1).findIndex((value) => value !== undefined);
		tokens.push({ type: patterns[group][0], text: match[0] });
		last = index + match[0].length;
	}

	if (last < code.length) tokens.push({ type: 'plain', text: code.slice(last) });

	return tokens;
}

/** Maps a fenced code block's info string to a supported language (TypeScript by default) */
export function toLanguage(lang: string): Language {
	switch (lang) {
		case 'css':
		case 'scss':
			return 'css';
		case 'html':
		case 'xml':
		case 'svg':
			return 'html';
		case 'bash':
		case 'sh':
		case 'shell':
			return 'shell';
		default:
			return 'ts';
	}
}
