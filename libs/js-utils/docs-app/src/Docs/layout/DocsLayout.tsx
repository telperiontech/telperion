import type { ReactNode } from 'react';
import { Code } from '@osw/react';
import { DocsShell, SidebarLayout } from '@osw/docs';
import { model } from '../model';
import { overviewPath, SOURCE_URL } from '../routing';
import { Sidebar } from './Sidebar';

interface DocsLayoutProps {
	activeId?: string;
	children: ReactNode;
}

const generatedOn = (iso: string) => new Date(iso).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });

export function DocsLayout({ activeId, children }: DocsLayoutProps) {
	return (
		<DocsShell
			nav={{ name: 'js-utils', version: model.version, homeHref: overviewPath(), sourceUrl: SOURCE_URL, packageName: model.packageName }}
			footer={
				<>
					Generated from the source of <Code code={`${model.packageName}@${model.version}`} /> on {generatedOn(model.generatedAt)}.
				</>
			}
		>
			<SidebarLayout menuLabel="Browse modules" sidebar={(onNavigate) => <Sidebar activeId={activeId} onNavigate={onNavigate} />}>
				{children}
			</SidebarLayout>
		</DocsShell>
	);
}
