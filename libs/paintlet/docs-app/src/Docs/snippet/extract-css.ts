/**
 * Builds a copyable stylesheet from what a story actually rendered: inline `style`
 * attributes become rules, `<style>` blocks are kept, and `@keyframes` referenced by name
 * (e.g. ones a decorator added to the document) are pulled in from the page.
 *
 * Raw attribute text is used instead of the CSSOM, which would drop declarations
 * (like `--tp-rain()`) in engines that cannot parse them.
 */

/** Splits on `separator` outside parentheses and quotes */
function splitTopLevel(text: string, separator: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let quote: string | undefined;
	let current = '';

	for (const char of text) {
		if (quote) {
			if (char === quote) quote = undefined;
		} else if (char === '"' || char === "'") {
			quote = char;
		} else if (char === '(') {
			depth++;
		} else if (char === ')') {
			depth--;
		} else if (char === separator && depth === 0) {
			parts.push(current);
			current = '';

			continue;
		}
		current += char;
	}

	return [...parts, current].map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function dedent(text: string): string {
	const lines = text.replace(/^\s*\n|\s+$/g, '').split('\n');
	const indent = Math.min(...lines.filter((line) => line.trim()).map((line) => line.match(/^\s*/)?.[0].length ?? 0));

	return lines.map((line) => line.slice(indent)).join('\n');
}

/** Plain animation names (not `--tp-*-animation()` functions) used by the declarations */
function animationNames(declarations: string[]): string[] {
	return declarations
		.filter((declaration) => /^animation(-name)?\s*:/.test(declaration))
		.flatMap((declaration) => splitTopLevel(declaration.slice(declaration.indexOf(':') + 1), ','))
		.flatMap((animation) => animation.split(/\s+/).filter((token) => /^-?[a-zA-Z_][\w-]*$/.test(token) && !token.startsWith('--')))
		.filter((token) => !/^(infinite|alternate|alternate-reverse|reverse|normal|linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end|forwards|backwards|both|none|running|paused)$/.test(token));
}

function findKeyframes(name: string): string | undefined {
	for (const sheet of document.styleSheets) {
		let rules: CSSRuleList;

		try {
			rules = sheet.cssRules;
		} catch {
			continue; // Cross-origin sheet
		}

		for (const rule of rules) {
			if (rule instanceof CSSKeyframesRule && rule.name === name) return rule.cssText;
		}
	}

	return undefined;
}

const formatRule = (selector: string, declarations: string[]) =>
	`${selector} {\n${declarations.map((declaration) => `  ${declaration};`).join('\n')}\n}`;

export function extractCss(container: HTMLElement): string {
	const styled = [...container.querySelectorAll<HTMLElement>('[style]')];
	const styleBlocks = [...container.querySelectorAll('style')].map((style) => dedent(style.textContent ?? ''));
	const rules = styled.map((element, index) => {
		const declarations = splitTopLevel(element.getAttribute('style') ?? '', ';');
		const selector = styled.length === 1 ? '.paintlet' : `.paintlet-${index + 1}`;

		return { selector, declarations };
	});
	const localCss = styleBlocks.join('\n');
	const keyframes = [...new Set(rules.flatMap((rule) => animationNames(rule.declarations)))]
		.filter((name) => !localCss.includes(`@keyframes ${name}`))
		.map(findKeyframes)
		.filter((rule): rule is string => !!rule);

	return [...rules.map((rule) => formatRule(rule.selector, rule.declarations)), ...styleBlocks, ...keyframes].join('\n\n');
}
