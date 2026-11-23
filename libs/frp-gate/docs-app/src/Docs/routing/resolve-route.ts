import { pathSegments } from '@osw/docs';
import type { Page } from '../../model/types';
import { getPage } from '../model';
import { BASE_PATH } from './paths';

export type Route = { type: 'home' } | { type: 'page'; page: Page } | { type: 'not-found' };

/** `/frp-gate` → home, `/frp-gate/<slug>` → a guide, reference or examples page */
export function resolveRoute(pathname: string): Route {
	const segments = pathSegments(pathname, BASE_PATH);

	if (!segments || segments.length > 1) return { type: 'not-found' };

	if (!segments.length) return { type: 'home' };

	const page = getPage(segments[0]);

	return page ? { type: 'page', page } : { type: 'not-found' };
}
