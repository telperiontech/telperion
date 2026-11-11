/**
 * Minimal JSDoc parser for the Custom Elements Manifest plugins: splits a raw `/** … *\/`
 * block into its description and tags, keeping fenced code (e.g. in `@example`) intact.
 */

const FENCE = /^\s*```/;

/** Comment body lines without the `/**`, `*\/` and leading ` * ` decoration */
function bodyLines(raw) {
	return raw
		.replace(/^\/\*\*/, '')
		.replace(/\*\/$/, '')
		.split(/\r?\n/)
		.map((line) => line.replace(/^\s*\* ?/, ''));
}

/**
 * Parses a tag body such as `{"a" | "b"} [variant="a"] - Visual treatment.`
 * into `{ type, name, default, description }`. A leading `-` means "no name" (e.g. the default `@slot`).
 */
function parseTagBody(body) {
	let rest = body.trim();
	let type;

	if (rest.startsWith('{')) {
		let depth = 0;
		let end = 0;

		for (; end < rest.length; end++) {
			if (rest[end] === '{') depth++;
			else if (rest[end] === '}' && --depth === 0) break;
		}
		type = rest.slice(1, end).trim();
		rest = rest.slice(end + 1).trim();
	}

	let name = '';
	let defaultValue;
	const optional = rest.match(/^\[([^\]=]+)(?:=([^\]]*))?\]\s*/);

	if (optional) {
		name = optional[1].trim();
		defaultValue = optional[2]?.trim();
		rest = rest.slice(optional[0].length);
	} else if (!/^-(\s|$)/.test(rest)) {
		const token = rest.match(/^(\S+)\s*/);

		if (token) {
			name = token[1];
			rest = rest.slice(token[0].length);
		}
	}

	const description = rest.replace(/^-(\s+|$)/, '').trim();

	return { type, name, default: defaultValue, description };
}

/** `{ description, tags: [{ tag, body }] }` for a raw JSDoc block */
export function parseJsDoc(raw) {
	const description = [];
	const tags = [];
	let inFence = false;

	for (const line of bodyLines(raw)) {
		if (FENCE.test(line)) inFence = !inFence;

		const tag = !inFence && line.match(/^@(\w+)\s?(.*)$/);

		if (tag) tags.push({ tag: tag[1], lines: [tag[2]] });
		else if (tags.length) tags[tags.length - 1].lines.push(line);
		else description.push(line);
	}

	return {
		description: description.join('\n').trim(),
		tags: tags.map(({ tag, lines }) => ({ tag, body: lines.join('\n').trim() })),
	};
}

const TAG_GROUPS = {
	attributes: ['attr', 'attribute'],
	properties: ['prop', 'property'],
	events: ['fires', 'event'],
	slots: ['slot'],
	cssProperties: ['cssprop', 'cssproperty'],
	cssParts: ['csspart', 'part'],
	cssStates: ['cssstate'],
};

/** Element-level documentation from a JSDoc block: description, API tags and examples */
export function elementDocFrom(raw) {
	const { description, tags } = parseJsDoc(raw);
	const doc = { description, examples: [] };

	for (const [group, names] of Object.entries(TAG_GROUPS)) {
		doc[group] = tags
			.filter(({ tag }) => names.includes(tag))
			.map(({ body }) => parseTagBody(body.replace(/\s*\n\s*/g, ' ')));
	}

	for (const { tag, body } of tags) {
		if (tag !== 'example') continue;

		// `@example Caption` followed by a fenced block: the caption becomes a label
		const [first, ...rest] = body.split('\n');
		const hasCaption = first.trim() && !FENCE.test(first);

		doc.examples.push({ caption: hasCaption ? first.trim() : undefined, code: (hasCaption ? rest.join('\n') : body).trim() });
	}

	return doc;
}
