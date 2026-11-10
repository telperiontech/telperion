import { useMemo } from 'react';
import { CopyButton } from '@osw/react';
import { highlight, type TokenType } from './highlight';

/** Full class names so Tailwind can scan them */
const TOKEN_CLASSES: Record<TokenType, string> = {
	comment: 'text-neutral-550 italic',
	string: 'text-success-750',
	keyword: 'text-secondary-700',
	number: 'text-quaternary-800',
	type: 'text-tertiary-800',
	plain: '',
};

interface CodeBlockProps {
	code: string;
	/** Hides the copy button, e.g. for type signatures */
	copyable?: boolean;
	className?: string;
}

export function CodeBlock({ code, copyable = true, className = '' }: CodeBlockProps) {
	const tokens = useMemo(() => highlight(code), [code]);

	return (
		<div className={`relative rounded-lg border border-neutral-100 bg-neutral-20 ${className}`}>
			{copyable && <CopyButton text={code} className="absolute top-2 right-2 bg-neutral-20" />}
			<pre className="overflow-x-auto p-4 pr-12 font-mono text-[13px] leading-relaxed text-neutral-990">
				<code>
					{tokens.map((token, index) =>
						token.type === 'plain' ? token.text : <span key={index} className={TOKEN_CLASSES[token.type]}>{token.text}</span>,
					)}
				</code>
			</pre>
		</div>
	);
}
