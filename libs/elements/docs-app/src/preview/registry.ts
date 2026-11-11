import { createStoryRegistry, modulesOf } from '@osw/stories/core';

/**
 * Every `*.stories.ts` of the library, with their side effects: importing a story
 * defines the elements it renders. Only the preview iframe may do this (see `protocol/messages.ts`).
 */
const context = import.meta.webpackContext('../../../src', {
	recursive: true,
	regExp: /\.stories\.ts$/,
	mode: 'sync',
});

export const registry = createStoryRegistry(modulesOf(context));
