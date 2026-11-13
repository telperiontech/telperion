import { trackShellNotFound } from './not-found';
import { trackPageViews } from './page-views';

/**
 * Page views and shell-level events. Imported from `bootstrap.ts` only: it uses the shared
 * `@osw/core`, which can't be consumed from `main.ts`. A no-op when gtag isn't loaded.
 */
export function startTracking(): void {
	if (!window.gtag) return;

	trackPageViews();
	trackShellNotFound();
}
