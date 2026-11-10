import { useState, type ReactNode } from 'react';
import { Icon } from '@osw/react';
import { DocsFooter } from './DocsFooter';
import { DocsNav } from './DocsNav';
import { Sidebar } from './Sidebar';

interface DocsLayoutProps {
	activeId?: string;
	children: ReactNode;
}

export function DocsLayout({ activeId, children }: DocsLayoutProps) {
	const [menuOpen, setMenuOpen] = useState(false);

	return (
		<div className="flex min-h-screen flex-col bg-white font-sans text-neutral-990">
			<DocsNav />

			<div className="mx-auto grid w-full max-w-7xl flex-1 gap-8 px-4 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
				{/* Mobile: collapsible module list above the content */}
				<div className="pt-4 lg:hidden">
					<button
						type="button"
						onClick={() => setMenuOpen((open) => !open)}
						aria-expanded={menuOpen}
						className="flex w-full items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 text-sm font-medium"
					>
						Browse modules
						<span className={menuOpen ? 'hidden' : 'contents'}><Icon name="expand_more" size={18} /></span>
						<span className={menuOpen ? 'contents' : 'hidden'}><Icon name="expand_less" size={18} /></span>
					</button>
					{menuOpen && (
						<div className="mt-3 rounded-lg border border-neutral-100 p-3">
							<Sidebar activeId={activeId} onNavigate={() => setMenuOpen(false)} />
						</div>
					)}
				</div>

				<aside className="hidden lg:block">
					<div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto py-8 pr-2">
						<Sidebar activeId={activeId} />
					</div>
				</aside>

				<main className="min-w-0 py-8 lg:py-10">{children}</main>
			</div>

			<DocsFooter />
		</div>
	);
}
