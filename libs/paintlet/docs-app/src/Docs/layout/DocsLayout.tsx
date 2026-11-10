import type { ReactNode } from 'react';
import { DocsFooter } from './DocsFooter';
import { DocsNav } from './DocsNav';

export function DocsLayout({ children }: { children: ReactNode }) {
	return (
		<div className="flex min-h-screen flex-col bg-white font-sans text-neutral-990">
			<DocsNav />
			<div className="flex-1">{children}</div>
			<DocsFooter />
		</div>
	);
}
