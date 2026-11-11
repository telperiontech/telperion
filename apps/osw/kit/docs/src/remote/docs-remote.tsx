import { StrictMode, type ComponentType } from 'react';
import * as ReactDOM from 'react-dom/client';
import type { OswRemote } from '@osw/core';

/**
 * The Module Federation `bootstrap` of a docs remote: mounts `Docs` into the shell's element,
 * and on unmount restores the document title the remote's pages changed.
 */
export function docsRemote(Docs: ComponentType): OswRemote['bootstrap'] {
	return (element) => {
		const root = ReactDOM.createRoot(element);
		const previousTitle = document.title;

		root.render(
			<StrictMode>
				<Docs />
			</StrictMode>
		);

		return () => {
			root.unmount();
			document.title = previousTitle;
		};
	};
}
