import { pathSegments } from '@osw/docs';
import { getEntry, type EntryDoc } from '../model';
import { findStory, type EntryStory } from '../stories';
import { BASE_PATH } from './paths';

export type Route =
	| { type: 'home' }
	| { type: 'entry'; entry: EntryDoc }
	| ({ type: 'playground'; entry: EntryDoc } & EntryStory)
	| { type: 'not-found' };

/** `/elements` → home, `/elements/<entry>` → docs, `/elements/<entry>/<story>` → playground */
export function resolveRoute(pathname: string): Route {
	const segments = pathSegments(pathname, BASE_PATH);

	if (!segments || segments.length > 2) return { type: 'not-found' };

	if (!segments.length) return { type: 'home' };

	const entry = getEntry(segments[0]);

	if (!entry) return { type: 'not-found' };

	if (segments.length === 1) return { type: 'entry', entry };

	const found = findStory(entry, segments[1]);

	return found ? { type: 'playground', entry, ...found } : { type: 'not-found' };
}
