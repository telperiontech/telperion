interface CodeProps {
	code: string;
	/** Any Shiki language id or alias; empty or unknown renders plain text */
	language?: string;
	variant?: 'inline' | 'block';
	/** Block only. Shows `<tp-code>`'s own copy button */
	copyable?: boolean;
	/** Block only */
	lineNumbers?: boolean;
	/** Block only. Lines to emphasize, e.g. `"2, 4-6"` */
	highlightLines?: string;
	className?: string;
	title?: string;
}

/** Boolean attribute value: present (`""`) or omitted */
const flag = (on: boolean | undefined): '' | undefined => (on ? '' : undefined);

/**
 * Thin React wrapper over `<tp-code>` from `@telperion/elements/code`, which the shell registers.
 * React 18 sets attributes on custom elements, so the source goes in as a text child (no
 * HTML parsing involved) rather than through the `code` property.
 */
export function Code({ code, language, variant = 'inline', copyable, lineNumbers, highlightLines, className, title }: CodeProps) {
	return (
		<tp-code
			variant={variant}
			language={language}
			copyable={flag(copyable)}
			line-numbers={flag(lineNumbers)}
			highlight-lines={highlightLines}
			class={className}
			title={title}
		>
			{code}
		</tp-code>
	);
}
