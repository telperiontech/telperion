import type { ReactNode } from 'react';
import { SidebarLayout } from '@osw/docs';
import { EntrySidebar } from './EntrySidebar';

interface EntryLayoutProps {
	activeEntryId?: string;
	activeStoryId?: string;
	children: ReactNode;
}

/** Sidebar layout shared by the entry docs and the playground */
export function EntryLayout({ activeEntryId, activeStoryId, children }: EntryLayoutProps) {
	return (
		<SidebarLayout
			menuLabel="Browse elements"
			sidebar={(onNavigate) => <EntrySidebar activeEntryId={activeEntryId} activeStoryId={activeStoryId} onNavigate={onNavigate} />}
		>
			{children}
		</SidebarLayout>
	);
}
