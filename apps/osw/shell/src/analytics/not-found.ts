import { trackEvent } from '@osw/core';
import { ROUTE_LOAD_EVENT } from '@telperion/elements/router';

/**
 * Reports `page_not_found` when the shell's catch-all route loads `/404.html`.
 * Unknown paths inside a remote are reported by that remote's `<NotFound>` page.
 */
export function trackShellNotFound(): () => void {
	const onRouteLoad = (event: Event) => {
		const { src } = (event as CustomEvent<{ src: string }>).detail;

		if (new URL(src, window.location.href).pathname === '/404.html') {
			trackEvent('page_not_found', { page_location: window.location.href });
		}
	};

	document.addEventListener(ROUTE_LOAD_EVENT, onRouteLoad);
	return () => document.removeEventListener(ROUTE_LOAD_EVENT, onRouteLoad);
}
