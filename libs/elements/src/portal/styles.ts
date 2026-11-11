let injected = false;

/**
 * Document-level defaults, adopted once:
 * - `tp-portal` never renders in place; its content only shows in an outlet.
 * - `tp-portal-outlet` is layout-transparent so projected content behaves as
 *   if it were a direct child of the outlet's parent. Override freely.
 * - `tp-portal-outlet-fallback` is layout-transparent too, and hidden while
 *   its outlet is `active`. The hide rule is `!important` on purpose: it
 *   reflects state, so a consumer's `display` styling must not reveal it.
 */
export function injectPortalStyles(): void {
  if (injected || typeof document === "undefined") return;
  injected = true;
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`
      :where(tp-portal) { display: none; }
      :where(tp-portal-outlet) { display: contents; }
      :where(tp-portal-outlet-fallback) { display: contents; }
      tp-portal-outlet[active] > tp-portal-outlet-fallback { display: none !important; }
    `);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  } catch {
    /* constructable stylesheets unsupported — styles are optional */
  }
}
