import type { ConsentChoice } from './consent';

/**
 * Loads gtag.js under Consent Mode v2: ad features are always off, analytics storage
 * follows the visitor's choice (denied until they accept, so no cookies are set before).
 */
export function loadGtag(measurementId: string, analytics: ConsentChoice): void {
	window.dataLayer = window.dataLayer || [];
	window.gtag = function gtag() {
		// gtag.js only understands the `arguments` object, not a rest array
		// eslint-disable-next-line prefer-rest-params
		window.dataLayer.push(arguments);
	};

	window.gtag('consent', 'default', {
		ad_storage: 'denied',
		ad_user_data: 'denied',
		ad_personalization: 'denied',
		analytics_storage: analytics,
	});
	window.gtag('js', new Date());
	// Page views are sent by `trackPageViews` once the remote has set the page title
	window.gtag('config', measurementId, { send_page_view: false });

	const script = document.createElement('script');
	script.async = true;
	script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
	document.head.append(script);
}
