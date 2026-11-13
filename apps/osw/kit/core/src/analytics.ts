/** Event parameters as GA4 accepts them */
export type TrackEventParams = Record<string, string | number | boolean | undefined>;

/**
 * Sends a GA4 event through the shell's gtag. Does nothing when analytics is off (no
 * measurement ID, or a remote running on its own), so remotes can call it freely.
 * Consent is handled by the shell: without it gtag sends no cookies.
 */
export function trackEvent(name: string, params: TrackEventParams = {}): void {
	window.gtag?.('event', name, params);
}
