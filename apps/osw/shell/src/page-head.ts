import { onNavigate } from '@osw/core';

/** The `<head>` element matching `selector`, created from `create` when missing */
function headElement<T extends HTMLElement>(selector: string, create: () => T): T {
	return document.head.querySelector<T>(selector) ?? document.head.appendChild(create());
}

/**
 * Keeps the page-specific `<head>` tags right on every navigation. Every route serves the same
 * `index.html`, so without this all pages would share one description and declare no canonical URL,
 * and crawlers could fold them into `/` as duplicates.
 *
 * - `<link rel="canonical">`: the current path on this origin, without query or hash
 * - `<meta name="description">`: reset to `index.html`'s when the path changes, for remotes to override
 *   (`usePageMeta` of `@osw/docs`). This runs synchronously on navigation, before the remotes re-render.
 */
export function trackPageHead(): () => void {
	const canonical = headElement('link[rel="canonical"]', () =>
		Object.assign(document.createElement('link'), { rel: 'canonical' })
	);
	const description = headElement('meta[name="description"]', () =>
		Object.assign(document.createElement('meta'), { name: 'description' })
	);
	const defaultDescription = description.content;
	let lastPath: string | undefined;
	const update = () => {
		const { pathname, origin } = window.location;

		// Anchor and query changes stay on the same page, whose remote won't set its description again
		if (pathname === lastPath) return;

		lastPath = pathname;
		canonical.href = new URL(pathname, origin).href;
		description.content = defaultDescription;
	};

	update();

	return onNavigate(update);
}
