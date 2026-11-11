import type { ReactNode } from 'react';
import { DocsFooter } from './DocsFooter';
import { DocsNav, type DocsNavProps } from './DocsNav';

interface DocsShellProps {
	nav: DocsNavProps;
	/** Remote-specific footer note */
	footer: ReactNode;
	children: ReactNode;
}

/** Page frame of a docs remote: sticky nav, growing content, footer */
export function DocsShell({ nav, footer, children }: DocsShellProps) {
	return (
		<div className="flex min-h-screen flex-col bg-white font-sans text-neutral-990">
			<DocsNav {...nav} />
			<div className="flex-1">{children}</div>
			<DocsFooter>{footer}</DocsFooter>
		</div>
	);
}
