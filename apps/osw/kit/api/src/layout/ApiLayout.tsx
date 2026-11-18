import type { ReactNode } from 'react';
import { Code } from '@osw/react';
import { DocsShell, SidebarLayout, treeUrl } from '@osw/docs';
import { useApiDocs } from '../config';
import { ApiSidebar } from './ApiSidebar';

interface ApiLayoutProps {
	activeId?: string;
	children: ReactNode;
}

const generatedOn = (iso: string) => new Date(iso).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });

/** Docs frame with the module sidebar and a "generated from" footer note */
export function ApiLayout({ activeId, children }: ApiLayoutProps) {
	const { model, name, libRoot, overviewPath } = useApiDocs();

	return (
		<DocsShell
			nav={{ name, version: model.version, homeHref: overviewPath(), sourceUrl: treeUrl(libRoot), packageName: model.packageName }}
			footer={
				<>
					Generated from the source of <Code code={`${model.packageName}@${model.version}`} /> on {generatedOn(model.generatedAt)}.
				</>
			}
		>
			<SidebarLayout menuLabel="Browse modules" sidebar={(onNavigate) => <ApiSidebar activeId={activeId} onNavigate={onNavigate} />}>
				{children}
			</SidebarLayout>
		</DocsShell>
	);
}
