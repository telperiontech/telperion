import type { ReactNode } from 'react';
import { Code } from '@osw/react';
import { DocsShell, SidebarLayout } from '@osw/docs';
import { IMAGE_REF, model } from '../model';
import { homePath, SOURCE_URL } from '../routing';
import { Sidebar } from './Sidebar';

interface DocsLayoutProps {
	/** Slug of the current page; `''` for the overview, `undefined` when there is none */
	activeSlug?: string;
	children: ReactNode;
}

export function DocsLayout({ activeSlug, children }: DocsLayoutProps) {
	return (
		<DocsShell
			nav={{ name: model.name, version: model.version, homeHref: homePath(), sourceUrl: SOURCE_URL, packageName: IMAGE_REF, image: model.image }}
			footer={
				<>
					Guides from the README, references generated from the Go sources of <Code code={`${IMAGE_REF}:${model.version}`} />.
				</>
			}
		>
			<SidebarLayout menuLabel="Browse pages" sidebar={(onNavigate) => <Sidebar activeSlug={activeSlug} onNavigate={onNavigate} />}>
				{children}
			</SidebarLayout>
		</DocsShell>
	);
}
