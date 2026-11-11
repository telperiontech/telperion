/**
 * Names of the `<tp-portal-outlet>`s in the shell's page chrome (`apps/osw/shell/src/index.html`).
 * A remote fills one by rendering `<tp-portal name="…">` anywhere in its tree, with any framework;
 * the shell registers the portal elements. While no remote projects into an outlet, the shell's
 * `<tp-portal-outlet-fallback>` content shows instead.
 *
 * Projected content lives outside the remote's root element, so framework event delegation
 * (e.g. React's `onClick`) doesn't reach it. Use plain links or native listeners there.
 */
export const OSW_SLOTS = {
	/** Right of the Telperion logo: what the page is about, e.g. `/ paintlet v1.2.0` */
	headerContext: 'osw-header-context',
	/** Right side of the header: page links and registry/source icons (npm, GHCR, GitHub, …) */
	headerActions: 'osw-header-actions',
	/** Footer bottom bar, next to the copyright: a remote-specific note */
	footerNote: 'osw-footer-note',
} as const;

export type OswSlot = (typeof OSW_SLOTS)[keyof typeof OSW_SLOTS];
