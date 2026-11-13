import { useEffect } from 'react';
import { trackEvent } from '@osw/core';

/** Typing pause after which a filter query counts as a search */
const SEARCH_DELAY = 1000;

/**
 * Reports GA4's `search` event for a live filter box once the visitor stops typing,
 * so one search isn't counted per keystroke. `results` helps spot searches that find nothing.
 */
export function useSearchTracking(query: string, results: number): void {
	useEffect(() => {
		const term = query.trim();

		if (!term) return;

		const timer = setTimeout(() => trackEvent('search', { search_term: term.slice(0, 100), results }), SEARCH_DELAY);

		return () => clearTimeout(timer);
	}, [query, results]);
}
