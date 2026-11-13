export type ConsentChoice = 'granted' | 'denied';

const STORAGE_KEY = 'osw.analytics-consent';

/** The visitor's saved analytics choice; `undefined` until they answer the banner */
export function storedConsent(): ConsentChoice | undefined {
	try {
		const value = localStorage.getItem(STORAGE_KEY);

		return value === 'granted' || value === 'denied' ? value : undefined;
	} catch {
		// Storage can be blocked (privacy modes); the banner then asks on every visit
		return undefined;
	}
}

/** Saves the choice and applies it to the running gtag (Consent Mode v2) */
export function saveConsent(choice: ConsentChoice): void {
	try {
		localStorage.setItem(STORAGE_KEY, choice);
	} catch {
		// See `storedConsent`: the choice still applies for this page load
	}

	window.gtag?.('consent', 'update', { analytics_storage: choice });
}
