import { Fragment, type ReactNode } from 'react';
import { ExternalLink } from '@osw/react';

/** `code`, **bold** / __bold__ and [links](url); everything else stays plain text */
const TOKEN = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\[[^\]]+\]\([^)\s]+\))/g;

function renderToken(token: string, key: number): ReactNode {
	if (token.startsWith('`')) {
		return (
			<code key={key} className="rounded bg-neutral-50 px-1 py-0.5 font-mono text-[0.85em] text-neutral-990">
				{token.slice(1, -1)}
			</code>
		);
	}

	if (token.startsWith('**') || token.startsWith('__')) {
		return <strong key={key} className="font-semibold text-neutral-990">{token.slice(2, -2)}</strong>;
	}

	const [, label, href] = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/) ?? [];

	return (
		<ExternalLink key={key} href={href} className="font-medium text-secondary-800 hover:underline">
			{label}
		</ExternalLink>
	);
}

/** Inline markdown: code spans, bold and links */
export function Inline({ text }: { text: string }) {
	return (
		<>
			{text.split(TOKEN).map((part, index) =>
				index % 2 ? renderToken(part, index) : <Fragment key={index}>{part}</Fragment>,
			)}
		</>
	);
}
