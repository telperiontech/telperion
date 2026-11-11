import type { ReactNode } from 'react';
import { Code, Icon } from '@osw/react';
import { DocsShell, navLinkClass } from '@osw/docs';
import { model } from '../model';
import { entryPath, homePath, SOURCE_URL } from '../routing';

export function DocsLayout({ children }: { children: ReactNode }) {
	const firstEntry = model.entries[0];

	return (
		<DocsShell
			nav={{
				name: 'elements',
				version: model.version,
				homeHref: homePath(),
				sourceUrl: SOURCE_URL,
				packageName: model.packageName,
				links: firstEntry && (
					<a href={entryPath(firstEntry.id)} className={navLinkClass}>
						<Icon name="widgets" size={18} />
						Elements
					</a>
				),
			}}
			footer={
				<>
					API generated from the Custom Elements Manifest of <Code code={`${model.packageName}@${model.version}`} />; previews run its Storybook stories.
				</>
			}
		>
			{children}
		</DocsShell>
	);
}
