export type TokenType = 'comment' | 'string' | 'keyword' | 'number' | 'type' | 'plain';

export interface Token {
	type: TokenType;
	text: string;
}

const KEYWORDS = [
	'import', 'from', 'export', 'const', 'let', 'var', 'function', 'return', 'async', 'await', 'new', 'class', 'extends',
	'interface', 'type', 'typeof', 'keyof', 'if', 'else', 'for', 'of', 'in', 'true', 'false', 'null', 'undefined',
	'this', 'static', 'readonly', 'get', 'set', 'void', 'any', 'unknown', 'never', 'string', 'number', 'boolean',
];

const PATTERNS: [TokenType, string][] = [
	['comment', String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/`],
	['string', String.raw`"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\x60(?:\\.|[^\x60\\])*\x60`],
	['keyword', String.raw`\b(?:${KEYWORDS.join('|')})\b`],
	['number', String.raw`\b\d[\d_]*(?:\.\d+)?\b`],
	['type', String.raw`\b[A-Z][A-Za-z0-9_]*\b`],
];

const MATCHER = new RegExp(PATTERNS.map(([, source]) => `(${source})`).join('|'), 'g');

/** Tiny TypeScript tokenizer for doc examples and signatures; no dependencies, good enough for display */
export function highlight(code: string): Token[] {
	const tokens: Token[] = [];
	let last = 0;

	for (const match of code.matchAll(MATCHER)) {
		const index = match.index ?? 0;
		if (index > last) tokens.push({ type: 'plain', text: code.slice(last, index) });

		const group = match.slice(1).findIndex((value) => value !== undefined);
		tokens.push({ type: PATTERNS[group][0], text: match[0] });
		last = index + match[0].length;
	}

	if (last < code.length) tokens.push({ type: 'plain', text: code.slice(last) });
	return tokens;
}
