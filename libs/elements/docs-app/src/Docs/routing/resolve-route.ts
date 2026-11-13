import { pathSegments } from '@osw/docs';
import { getEntry, type EntryDoc } from '../model';
import { findStory, type EntryStory } from '../stories';
import { BASE_PATH } from './paths';

export type Route =
	| { type: 'home' }
	| { type: 'entry'; entry: EntryDoc }
	| ({ type: 'playground'; entry: EntryDoc } & EntryStory)
	| { type: 'not-found' };

/**
 * `/elements` → home, `/elements/<entry>` → docs, `/elements/<entry>/<story>` → playground.
 * Entry ids may be nested (`code/cdn`), so the whole path is tried as an entry first.
 */
export function resolveRoute(pathname: string): Route {
	const segments = pathSegments(pathname, BASE_PATH);

	if (!segments) return { type: 'not-found' };

	if (!segments.length) return { type: 'home' };

	const entry = getEntry(segments.join('/'));

	if (entry) return { type: 'entry', entry };

	const parent = getEntry(segments.slice(0, -1).join('/'));
	const found = parent && findStory(parent, segments[segments.length - 1]);

	return found ? { type: 'playground', entry: parent, ...found } : { type: 'not-found' };
}
