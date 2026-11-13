import { defineConsentBanner } from './consent-banner';
import { storedConsent } from './consent';
import { loadGtag } from './gtag';

/**
 * Loads Google Analytics (when `GOOGLE_ANALYTICS_ID` is set) and the consent banner.
 * Runs from `main.ts`, before the remotes; page tracking starts later from `./tracking`,
 * which needs `@osw/core` and so must stay behind the bootstrap's async boundary.
 */
export function startAnalytics(): boolean {
	const measurementId = import.meta.env.GOOGLE_ANALYTICS_ID;

	if (!measurementId) return false;

	loadGtag(measurementId, storedConsent() ?? 'denied');
	defineConsentBanner();

	return true;
}
