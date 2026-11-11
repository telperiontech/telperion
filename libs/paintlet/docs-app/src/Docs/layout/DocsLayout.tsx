import type { ReactNode } from 'react';
import { Icon } from '@osw/react';
import { DocsShell, navLinkClass } from '@osw/docs';
import { PACKAGE_NAME, VERSION } from '../meta';
import { homePath, paintletPath, SOURCE_URL } from '../routing';
import { paintlets } from '../stories';

export function DocsLayout({ children }: { children: ReactNode }) {
	return (
		<DocsShell
			nav={{
				name: 'paintlet',
				version: VERSION,
				homeHref: homePath(),
				sourceUrl: SOURCE_URL,
				packageName: PACKAGE_NAME,
				links: paintlets[0] && (
					<a href={paintletPath(paintlets[0].id)} className={navLinkClass}>
						<Icon name="palette" size={18} />
						Playground
					</a>
				),
			}}
			footer={
				<>
					Live previews rendered from the Storybook stories of <code className="font-mono">{PACKAGE_NAME}@{VERSION}</code>.
				</>
			}
		>
			{children}
		</DocsShell>
	);
}
