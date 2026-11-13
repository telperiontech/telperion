import { onNavigate } from '@osw/core';

/** How long to wait for the remote to set `document.title` before sending the page view anyway */
const TITLE_TIMEOUT = 1000;

interface PendingView {
	location: string;
	send: () => void;
}

/** First path segment, i.e. the remote that renders the page (`/js-utils/array/compact` → `js-utils`) */
const remoteOf = (pathname: string): string => pathname.split('/').find(Boolean) ?? 'home';

/** Path and query; hash changes stay on the same page */
const pageKey = (url: URL): string => url.pathname + url.search;

/**
 * Sends a GA4 `page_view` for every shell page. Remotes set `document.title` after they
 * render, so each view waits for the next title change (or {@link TITLE_TIMEOUT}) to report
 * the new page's title rather than the previous one's. Remotes need no analytics code.
 */
export function trackPageViews(): () => void {
	let lastKey: string | undefined;
	let lastLocation = document.referrer;
	let pending: PendingView | undefined;

	const schedule = () => {
		const url = new URL(window.location.href);
		const key = pageKey(url);

		if (key === lastKey) return;

		// A new navigation before the previous title settled: report the previous page now
		pending?.send();
		lastKey = key;

		const location = url.href;
		const previousTitle = document.title;
		// Remotes also add stylesheets to the head while loading; only a new title counts
		const titleObserver = new MutationObserver(() => document.title !== previousTitle && send());
		const timer = setTimeout(() => send(), TITLE_TIMEOUT);
		let sent = false;

		const send = () => {
			if (sent) return;

			sent = true;
			clearTimeout(timer);
			titleObserver.disconnect();
			if (pending?.location === location) pending = undefined;

			window.gtag?.('event', 'page_view', {
				page_location: location,
				page_referrer: lastLocation,
				page_title: document.title,
				remote: remoteOf(url.pathname),
			});
			lastLocation = location;
		};

		// `<title>` may be replaced or its text changed, so watch the whole head
		titleObserver.observe(document.head, { subtree: true, childList: true, characterData: true });
		pending = { location, send };
	};

	schedule();

	return onNavigate(schedule);
}
