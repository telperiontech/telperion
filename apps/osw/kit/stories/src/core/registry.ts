import { toComponentDoc } from './to-component-doc';
import type { ComponentDoc, StoryDoc, StoryModule } from './types';

export interface StoryRegistry {
	/** Components sorted by title */
	components: ComponentDoc[];
	getComponent(id: string): ComponentDoc | undefined;
	getStory(component: ComponentDoc, storyId: string): StoryDoc | undefined;
}

/**
 * Indexes CSF modules, typically every `*.stories.ts` of a library collected with
 * `import.meta.webpackContext` (which needs a literal path, so it stays in each remote).
 */
export function createStoryRegistry(modules: Iterable<StoryModule>): StoryRegistry {
	// A webpack context may list one module under several keys; dedupe by module identity
	const components = [...new Set(modules)]
		.map(toComponentDoc)
		.filter((component): component is ComponentDoc => !!component)
		.sort((a, b) => a.title.localeCompare(b.title));
	const byId = new Map(components.map((component) => [component.id, component]));

	return {
		components,
		getComponent: (id) => byId.get(id),
		getStory: (component, storyId) => component.stories.find((story) => story.id === storyId),
	};
}

/** Loads every module of a webpack context synchronously */
export function modulesOf(context: { keys(): string[]; (key: string): unknown }): StoryModule[] {
	return context.keys().map((key) => context(key) as StoryModule);
}
