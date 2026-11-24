import { useEffect } from 'react';

/**
 * Sets the document title (and the meta description, when given) when the page changes and
 * scrolls back to the top, unless the URL points at an anchor. `pageKey` identifies the page
 * (e.g. the route object). Without a description the shell's default one stays: the shell
 * resets it on every navigation.
 */
export function usePageMeta(title: string, pageKey: unknown, description?: string): void {
	useEffect(() => {
		document.title = title;

		if (description) document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', description);

		if (!window.location.hash) window.scrollTo({ top: 0 });
	}, [title, description, pageKey]);
}
