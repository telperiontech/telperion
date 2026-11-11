import { nothing, render } from 'lit';
import type { Args, StoryContext, StoryDoc } from './types';

export function storyContext(story: StoryDoc, args: Args, title = story.componentId): StoryContext {
	return {
		id: `${story.componentId}--${story.id}`,
		name: story.name,
		title,
		args,
		argTypes: story.argTypes,
		parameters: story.parameters,
	};
}

/** Runs the story's render function wrapped in its decorators (story decorators innermost), like Storybook */
export function decoratedStory(story: StoryDoc, args: Args): unknown {
	const context = storyContext(story, args);
	const decorated = story.decorators.reduce<() => unknown>(
		(next, decorator) => () => decorator(next, context),
		() => story.render(args, context),
	);

	return decorated();
}

/**
 * Renders a story into `container` with lit. Light DOM on purpose: decorators may add
 * document-level styles (e.g. `@keyframes`), which would not reach into a shadow root.
 */
export function renderStory(story: StoryDoc, args: Args, container: HTMLElement): void {
	render(decoratedStory(story, args), container);
}

export function clearStory(container: HTMLElement): void {
	render(nothing, container);
}
