import { nothing, type TemplateResult } from 'lit';

/**
 * Prints a lit template as the plain HTML a consumer would write. Lit-only bindings are
 * dropped (`.prop=${}`, `@event=${}`), boolean attributes (`?attr=${}`) are kept when true,
 * and attributes bound to `nothing` / `undefined` are omitted, like lit renders them.
 * Directives cannot be printed without rendering and print as nothing.
 */

const isTemplate = (value: unknown): value is TemplateResult =>
	typeof value === 'object' && value !== null && '_$litType$' in value && 'strings' in value && 'values' in value;

const isAbsent = (value: unknown) => value === nothing || value === undefined || value === null;

const escapeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttribute = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function printChild(value: unknown): string {
	if (isAbsent(value) || value === false || typeof value === 'function') return '';

	if (isTemplate(value)) return tidy(printTemplate(value));

	if (Array.isArray(value)) return value.map(printChild).filter(Boolean).join('\n');

	if (typeof Node !== 'undefined' && value instanceof Node) return value instanceof Element ? value.outerHTML : escapeText(value.textContent ?? '');

	// Directive results and other objects need a render to resolve
	if (typeof value === 'object') return '';

	return escapeText(String(value));
}

/** `.prop=`, `@event=` and `?bool=` bindings at the end of the markup printed so far */
const SPECIAL_BINDING = /\s([.@?])([\w:.-]+)=(["']?)$/;
/** A plain `attr=` binding at the end of the markup printed so far */
const ATTRIBUTE_BINDING = /\s([\w:.-]+)=(["']?)$/;

function printTemplate({ strings, values }: TemplateResult): string {
	let html = '';
	/** Quote that closes a binding we removed, to skip at the start of the next string */
	let pendingQuote = '';

	strings.forEach((part, index) => {
		html += pendingQuote && part.startsWith(pendingQuote) ? part.slice(1) : part;
		pendingQuote = '';

		if (index >= values.length) return;

		const value = values[index];
		const special = html.match(SPECIAL_BINDING);

		if (special) {
			const [whole, prefix, name, quote] = special;

			html = html.slice(0, -whole.length);
			pendingQuote = quote;

			if (prefix === '?' && value && !isAbsent(value)) html += ` ${name}`;

			return;
		}

		const attribute = html.match(ATTRIBUTE_BINDING);

		if (attribute) {
			const [whole, , quote] = attribute;

			if (isAbsent(value)) {
				html = html.slice(0, -whole.length);
				pendingQuote = quote;
			} else if (quote) {
				html += escapeAttribute(String(value));
			} else {
				html += `"${escapeAttribute(String(value))}"`;
			}

			return;
		}

		// Nested templates are tidied on their own; indent their lines to where they are inserted
		const child = printChild(value);
		const indent = html.slice(html.lastIndexOf('\n') + 1).match(/^\s*/)?.[0] ?? '';

		html += child.replace(/\n/g, `\n${indent}`);
	});

	return html;
}

/** Removes the template's common indentation and surrounding blank lines */
function tidy(html: string): string {
	const lines = html.replace(/[ \t]+$/gm, '').split('\n');

	while (lines.length && !lines[0].trim()) lines.shift();

	while (lines.length && !lines[lines.length - 1].trim()) lines.pop();

	const indent = Math.min(...lines.filter((line) => line.trim()).map((line) => line.match(/^\s*/)?.[0].length ?? 0));

	return (
		lines
			.map((line) => line.slice(Number.isFinite(indent) ? indent : 0))
			.join('\n')
			// A removed binding on its own line leaves the tag's `>` stranded below blank lines
			.replace(/\s*\n\s*(\/?>)/g, '$1')
			.replace(/\n{3,}/g, '\n\n')
	);
}

export function templateToHtml(value: unknown): string {
	return tidy(printChild(value));
}
