import { useState, type ReactNode } from 'react';
import { Icon } from '@osw/react';

interface SidebarLayoutProps {
	/** Sidebar content; `onNavigate` closes the mobile drawer after a link is followed */
	sidebar: (onNavigate?: () => void) => ReactNode;
	/** Label of the mobile toggle, e.g. `Browse modules` */
	menuLabel: string;
	children: ReactNode;
}

/** Sticky sidebar on large screens, a collapsible list above the content on small ones */
export function SidebarLayout({ sidebar, menuLabel, children }: SidebarLayoutProps) {
	const [menuOpen, setMenuOpen] = useState(false);

	return (
		<div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
			<div className="pt-4 lg:hidden">
				<button
					type="button"
					onClick={() => setMenuOpen((open) => !open)}
					aria-expanded={menuOpen}
					className="flex w-full items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 text-sm font-medium"
				>
					{menuLabel}
					<span className={menuOpen ? 'hidden' : 'contents'}><Icon name="expand_more" size={18} /></span>
					<span className={menuOpen ? 'contents' : 'hidden'}><Icon name="expand_less" size={18} /></span>
				</button>
				{menuOpen && <div className="mt-3 rounded-lg border border-neutral-100 p-3">{sidebar(() => setMenuOpen(false))}</div>}
			</div>

			<aside className="hidden lg:block">
				<div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto py-8 pr-2">{sidebar()}</div>
			</aside>

			<main className="min-w-0 py-8 lg:py-10">{children}</main>
		</div>
	);
}
