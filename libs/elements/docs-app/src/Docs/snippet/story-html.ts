import { storyContext, type Args, type StoryDoc } from '@osw/stories';
import { templateToHtml } from './template-to-html';

/**
 * HTML of a story's own template for the given args. Decorators are left out on purpose:
 * they wrap the story for display and are not part of what a consumer would copy.
 */
export function storyHtml(story: StoryDoc, args: Args): string {
	try {
		return templateToHtml(story.render(args, storyContext(story, args)));
	} catch {
		return '';
	}
}
