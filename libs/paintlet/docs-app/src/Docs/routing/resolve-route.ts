import { getPaintlet, getStory, type PaintletDoc, type StoryDoc } from '../stories';
import { BASE_PATH } from './paths';

export type Route =
	| { type: 'home' }
	| { type: 'playground'; paintlet: PaintletDoc; story: StoryDoc }
	| { type: 'not-found' };

/** `/paintlet` → home, `/paintlet/<paintlet>[/<story>]` → playground (first story by default) */
export function resolveRoute(pathname: string): Route {
	if (!pathname.startsWith(BASE_PATH)) return { type: 'not-found' };

	const segments = pathname.slice(BASE_PATH.length).split('/').filter(Boolean);

	if (!segments.length) return { type: 'home' };

	if (segments.length > 2) return { type: 'not-found' };

	const paintlet = getPaintlet(segments[0]);

	if (!paintlet) return { type: 'not-found' };

	const story = segments[1] ? getStory(paintlet, segments[1]) : paintlet.stories[0];

	return story ? { type: 'playground', paintlet, story } : { type: 'not-found' };
}
