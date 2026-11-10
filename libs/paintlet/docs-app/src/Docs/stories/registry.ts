import '@telperion/paintlet';
import { toPaintletDoc } from './to-paintlet-doc';
import type { PaintletDoc, StoryDoc, StoryModule } from './types';

/**
 * Every `*.stories.ts` of the library, picked up at build time:
 * a new paintlet story shows up in the playground without touching this app.
 */
const context = import.meta.webpackContext('../../../../src', {
	recursive: true,
	regExp: /\.stories\.ts$/,
	mode: 'sync',
});
// A context may list one module under several keys; dedupe by module identity
const modules = [...new Set(context.keys().map((key) => context(key) as StoryModule))];

export const paintlets: PaintletDoc[] = modules
	.map(toPaintletDoc)
	.filter((paintlet): paintlet is PaintletDoc => !!paintlet)
	.sort((a, b) => a.title.localeCompare(b.title));

const paintletsById = new Map(paintlets.map((paintlet) => [paintlet.id, paintlet]));

export const getPaintlet = (id: string): PaintletDoc | undefined => paintletsById.get(id);

export const getStory = (paintlet: PaintletDoc, storyId: string): StoryDoc | undefined =>
	paintlet.stories.find((story) => story.id === storyId);
