import type { ReactNode } from 'react';
import { ExternalLink } from '@osw/react';
import { issuesUrl } from '../meta';

/** Footer with a remote-specific note (`children`), the issue tracker and the license */
export function DocsFooter({ children }: { children: ReactNode }) {
	return (
		<footer className="border-t border-neutral-100">
			<div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-neutral-850 sm:px-6">
				<p>{children}</p>
				<p className="flex gap-4">
					<ExternalLink href={issuesUrl()} className="hover:text-neutral-990">Report an issue</ExternalLink>
					<span>© {new Date().getFullYear()} Telperion · MIT</span>
				</p>
			</div>
		</footer>
	);
}
