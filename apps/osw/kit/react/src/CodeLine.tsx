import { Code } from './Code';
import { CopyButton } from './CopyButton';

interface CodeLineProps {
	/** The single line shown and copied, e.g. an import statement or an install command */
	code: string;
	/** Shiki language id, e.g. `ts` for imports or `sh` for commands */
	language?: string;
	/** Decorative prefix that is not copied, e.g. `$` for shell commands */
	prompt?: string;
	/** Background, width and spacing; the frame itself is shared */
	className?: string;
}

/**
 * A single highlighted, truncated line of code with a copy button.
 * Tightened inline `<tp-code>` styles live in the shell's `code.css` (`.osw-code-line`).
 */
export function CodeLine({ code, language, prompt, className = 'bg-neutral-30' }: CodeLineProps) {
	return (
		<div className={`osw-code-line flex items-center gap-2 rounded-lg border border-neutral-100 py-1 pr-1 pl-3 ${className}`}>
			{prompt && (
				<span aria-hidden="true" className="font-mono text-xs font-semibold text-tertiary-800 select-none">
					{prompt}
				</span>
			)}
			<div className="min-w-0 flex-1 truncate text-xs" title={code}>
				<Code code={code} language={language} />
			</div>
			<CopyButton text={code} />
		</div>
	);
}
