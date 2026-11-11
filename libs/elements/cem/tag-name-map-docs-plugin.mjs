import { elementDocFrom } from './parse-jsdoc.mjs';

/**
 * Custom Elements Manifest analyzer plugin for this library's documentation convention.
 *
 * Elements are documented either on the class or on their `HTMLElementTagNameMap` entry:
 *
 * ```ts
 * declare global {
 *   interface HTMLElementTagNameMap {
 *     /** Description… @attr {string} [position] - … @fires change - … *\/
 *     'tp-popover': PopoverElement;
 *   }
 * }
 * ```
 *
 * The analyzer only reads class comments, so this plugin collects both kinds of blocks and
 * merges them into the class declaration: a missing description, `@attr` / `@fires` /
 * `@slot` / `@cssprop` / `@csspart` / `@cssstate` entries (filling gaps in what the analyzer
 * found, adding what it missed) and `@example` blocks, appended to the description as markdown.
 */
export function tagNameMapDocsPlugin() {
	/** `${modulePath}::${className}` → parsed docs, in source order */
	const collected = new Map();

	const collect = (moduleDoc, className, raw) => {
		const key = `${moduleDoc.path}::${className}`;

		collected.set(key, [...(collected.get(key) ?? []), elementDocFrom(raw)]);
	};

	const rawJsDoc = (node) => {
		const doc = node.jsDoc?.[node.jsDoc.length - 1];

		return doc ? node.getSourceFile().text.slice(doc.pos, doc.end) : undefined;
	};

	return {
		name: 'telperion-tag-name-map-docs',

		analyzePhase({ ts, node, moduleDoc }) {
			if (ts.isClassDeclaration(node) && node.name) {
				const raw = rawJsDoc(node);

				// Class comments are already read by the analyzer; only their examples are missing
				if (raw) collect(moduleDoc, node.name.text, raw);

				return;
			}

			if (!ts.isInterfaceDeclaration(node) || node.name.text !== 'HTMLElementTagNameMap') return;

			for (const member of node.members) {
				const raw = rawJsDoc(member);
				const typeName = member.type && ts.isTypeReferenceNode(member.type) ? member.type.typeName.getText() : undefined;

				if (raw && typeName) collect(moduleDoc, typeName, raw);
			}
		},

		// `customElement` is only set during the analyzer's own package-link phase, which runs first
		packageLinkPhase({ customElementsManifest }) {
			for (const moduleDoc of customElementsManifest.modules) {
				for (const declaration of moduleDoc.declarations ?? []) {
					const docs = collected.get(`${moduleDoc.path}::${declaration.name}`);

					if (!docs || !declaration.customElement) continue;

					for (const doc of docs) mergeInto(declaration, doc);
				}
			}
		},
	};
}

function mergeNamed(target = [], additions, toEntry) {
	const result = [...target];

	for (const addition of additions) {
		const existing = result.find((item) => item.name === addition.name);
		const entry = toEntry(addition);

		if (!existing) {
			result.push(entry);
			continue;
		}

		for (const [key, value] of Object.entries(entry)) {
			if (value !== undefined && (existing[key] === undefined || existing[key] === '')) existing[key] = value;
		}
	}

	return result;
}

const withType = ({ type, ...rest }) => ({ ...rest, ...(type ? { type: { text: type } } : {}) });
const clean = (entry) => Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined && value !== ''));

function mergeInto(declaration, doc) {
	if (!declaration.description && doc.description) declaration.description = doc.description;

	const groups = {
		attributes: ({ name, type, default: value, description }) => clean(withType({ name, type, default: value, description })),
		events: ({ name, type, description }) => clean(withType({ name, type, description })),
		slots: ({ name, description }) => ({ name, ...clean({ description }) }),
		cssProperties: ({ name, default: value, description }) => clean({ name, default: value, description }),
		cssParts: ({ name, description }) => clean({ name, description }),
		cssStates: ({ name, description }) => clean({ name, description }),
	};

	for (const [group, toEntry] of Object.entries(groups)) {
		if (doc[group]?.length) declaration[group] = mergeNamed(declaration[group], doc[group], toEntry);
	}

	// Events the analyzer saw only by type (e.g. `dispatchEvent(new SelectChangeEvent(…))`) are
	// superseded by a named `@fires` entry
	if (declaration.events?.some((event) => event.name)) {
		declaration.events = declaration.events.filter((event) => event.name);
	}

	const examples = doc.examples
		.map(({ caption, code }) => `${caption ? `**${caption}**\n\n` : ''}${code}`)
		.filter((example) => !declaration.description?.includes(example));

	if (examples.length) {
		declaration.description = [declaration.description, '#### Examples', ...examples].filter(Boolean).join('\n\n');
	}
}
