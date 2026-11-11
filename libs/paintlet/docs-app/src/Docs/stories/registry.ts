import '@telperion/paintlet';
import { createStoryRegistry, modulesOf } from '@osw/stories';

/**
 * Every `*.stories.ts` of the library, picked up at build time:
 * a new paintlet story shows up in the playground without touching this app.
 */
const context = import.meta.webpackContext('../../../../src', {
	recursive: true,
	regExp: /\.stories\.ts$/,
	mode: 'sync',
});

export const { components: paintlets, getComponent: getPaintlet, getStory } = createStoryRegistry(modulesOf(context));
