import { useSyncExternalStore } from 'react';

/**
 * Client-side navigation shared by the shell and every remote.
 *
 * The shell's `<tha-router>` (via the `history` package) and the remotes all listen to
 * `popstate`, so a navigation is a `pushState` followed by a synthetic `popstate`:
 * the shell re-matches its routes (mounting/unmounting remotes) and remotes update
 * their own sub-routes, without anyone sharing a history instance.
 */
export function navigate(to: string, { replace = false } = {}): void {
	const url = new URL(to, window.location.href);
	if (url.href === window.location.href) return;

	const state = { ...(window.history.state ?? {}) };
	if (replace) window.history.replaceState(state, '', url);
	else window.history.pushState(state, '', url);

	window.dispatchEvent(new PopStateEvent('popstate', { state }));
}

function subscribe(onChange: () => void): () => void {
	window.addEventListener('popstate', onChange);
	return () => window.removeEventListener('popstate', onChange);
}

/** Current `location.pathname`, re-rendering on every navigation */
export function usePathname(): string {
	return useSyncExternalStore(subscribe, () => window.location.pathname);
}

/** Current `location.hash`, re-rendering on every navigation */
export function useHash(): string {
	return useSyncExternalStore(subscribe, () => window.location.hash);
}
