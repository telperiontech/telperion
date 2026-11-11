import { Code } from '@osw/react';

interface CodeBlockProps {
	code: string;
	/** Any Shiki language id or alias (`ts`, `html`, `css`, `sh`, …); `text` renders plain */
	language?: string;
	/** Hides the copy button, e.g. for type signatures */
	copyable?: boolean;
	/** Frame overrides and spacing, applied to the `<tp-code>` host */
	className?: string;
}

/** A highlighted, framed code block: `<tp-code variant="block">` themed by the shell's `code.css` */
export function CodeBlock({ code, language = 'ts', copyable = true, className = '' }: CodeBlockProps) {
	return (
		<Code
			variant="block"
			code={code}
			language={language}
			copyable={copyable}
			className={`rounded-lg border border-neutral-100 ${className}`}
		/>
	);
}
