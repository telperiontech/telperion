import { pathSegments } from '@osw/docs';
import type { ComponentDoc, StoryDoc } from '@osw/stories';
import { getPaintlet, getStory } from '../stories';
import { BASE_PATH } from './paths';

export type Route =
	| { type: 'home' }
	| { type: 'playground'; paintlet: ComponentDoc; story: StoryDoc }
	| { type: 'not-found' };

/** `/paintlet` → home, `/paintlet/<paintlet>[/<story>]` → playground (first story by default) */
export function resolveRoute(pathname: string): Route {
	const segments = pathSegments(pathname, BASE_PATH);

	if (!segments || segments.length > 2) return { type: 'not-found' };

	if (!segments.length) return { type: 'home' };

	const paintlet = getPaintlet(segments[0]);

	if (!paintlet) return { type: 'not-found' };

	const story = segments[1] ? getStory(paintlet, segments[1]) : paintlet.stories[0];

	return story ? { type: 'playground', paintlet, story } : { type: 'not-found' };
}
