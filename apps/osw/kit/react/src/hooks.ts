import { useSyncExternalStore } from 'react';
import { onNavigate } from '@osw/core';

/** Current `location.pathname`, re-rendering on every navigation */
export function usePathname(): string {
	return useSyncExternalStore(onNavigate, () => window.location.pathname);
}

/** Current `location.hash`, re-rendering on every navigation */
export function useHash(): string {
	return useSyncExternalStore(onNavigate, () => window.location.hash);
}
