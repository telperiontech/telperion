import { useEffect } from 'react';

/**
 * Sets the document title when the page changes and scrolls back to the top,
 * unless the URL points at an anchor. `pageKey` identifies the page (e.g. the route object).
 */
export function usePageMeta(title: string, pageKey: unknown): void {
	useEffect(() => {
		document.title = title;

		if (!window.location.hash) window.scrollTo({ top: 0 });
	}, [title, pageKey]);
}
