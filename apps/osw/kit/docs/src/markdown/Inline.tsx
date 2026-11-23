import { Fragment, type ReactNode } from 'react';
import { Code, ExternalLink } from '@osw/react';

/** `code`, **bold** / __bold__ and [links](url); everything else stays plain text */
const TOKEN = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\[[^\]]+\]\([^)\s]+\))/g;

function renderToken(token: string, key: number): ReactNode {
	if (token.startsWith('`')) {
		return <Code key={key} code={token.slice(1, -1)} />;
	}

	if (token.startsWith('**') || token.startsWith('__')) {
		return <strong key={key} className="font-semibold text-neutral-900">{token.slice(2, -2)}</strong>;
	}

	const [, label, href] = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/) ?? [];
	const linkClass = 'font-medium text-secondary-660 hover:underline';

	// Paths on this site (`/frp-gate/metrics`, `#anchor`) stay in the tab and go through the shell's router
	if (href.startsWith('/') || href.startsWith('#')) {
		return <a key={key} href={href} className={linkClass}>{label}</a>;
	}

	return (
		<ExternalLink key={key} href={href} className={linkClass}>
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
