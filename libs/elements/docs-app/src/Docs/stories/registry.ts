import { createStoryRegistry, modulesOf, type ComponentDoc, type StoryDoc } from '@osw/stories';
import { entryOfTag, type EntryDoc } from '../model';

/**
 * Story metadata for routing, controls and snippets. `?meta` makes webpack load each
 * `*.stories.ts` through `strip-side-effect-imports`, so the element definitions they
 * import never run here: the stories run in the preview iframe instead.
 */
const context = import.meta.webpackContext('../../../../src?meta', {
	recursive: true,
	regExp: /\.stories\.ts$/,
	mode: 'sync',
});

const registry = createStoryRegistry(modulesOf(context));

/** Story files of an entry point, matched through the meta's `component` tag */
export const componentsOf = (entry: EntryDoc): ComponentDoc[] =>
	registry.components.filter((component) => component.component && entryOfTag(component.component)?.id === entry.id);

export interface EntryStory {
	component: ComponentDoc;
	story: StoryDoc;
}

/** Every story of an entry point, in sidebar order */
export const storiesOf = (entry: EntryDoc): EntryStory[] =>
	componentsOf(entry).flatMap((component) => component.stories.map((story) => ({ component, story })));

export const findStory = (entry: EntryDoc, storyId: string): EntryStory | undefined =>
	storiesOf(entry).find(({ story }) => story.id === storyId);
