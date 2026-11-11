import type { ReactNode } from 'react';
import { DocsFooter } from './DocsFooter';
import { DocsNav, type DocsNavProps } from './DocsNav';

interface DocsShellProps {
	nav: DocsNavProps;
	/** Remote-specific footer note */
	footer: ReactNode;
	children: ReactNode;
}

/**
 * Page frame of a docs remote. The header and footer belong to the shell;
 * `nav` and `footer` are projected into its outlets, `children` render in place.
 */
export function DocsShell({ nav, footer, children }: DocsShellProps) {
	return (
		<>
			<DocsNav {...nav} />
			{children}
			<DocsFooter>{footer}</DocsFooter>
		</>
	);
}
