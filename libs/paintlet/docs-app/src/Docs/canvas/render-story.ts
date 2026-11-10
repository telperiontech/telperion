import { nothing, render } from 'lit';
import type { Args, StoryContext, StoryDoc } from '../stories';

/**
 * Renders a story into `container` with lit, applying its decorators like Storybook does
 * (story decorators innermost). Light DOM on purpose: decorators may add document-level
 * `@keyframes`, which would not reach into a shadow root.
 */
export function renderStory(story: StoryDoc, args: Args, container: HTMLElement): void {
	const context: StoryContext = {
		id: `${story.paintletId}--${story.id}`,
		name: story.name,
		title: story.paintletId,
		args,
		argTypes: story.argTypes,
		parameters: story.parameters,
	};
	const decorated = story.decorators.reduce<() => unknown>(
		(next, decorator) => () => decorator(next, context),
		() => story.render(args, context),
	);

	render(decorated(), container);
}

export function clearStory(container: HTMLElement): void {
	render(nothing, container);
}
