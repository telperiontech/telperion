import { defaultRender } from './default-render';
import { storyNameFromExport, titleLeaf, toSlug } from './naming';
import type { ComponentDoc, CsfAnnotations, Decorator, StoryDoc, StoryModule } from './types';

const asArray = (decorators: CsfAnnotations['decorators']): Decorator[] =>
	!decorators ? [] : Array.isArray(decorators) ? decorators : [decorators];

/** Like Storybook, every plain-object named export is a story (`export const Default = {}` included) */
const isStory = (value: unknown): value is CsfAnnotations =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Story exports, `Default` first. Module namespaces list exports alphabetically, so source
 * order is lost (Storybook only keeps it through a build-time `__namedExportsOrder` export).
 */
function storyExportNames(module: StoryModule): string[] {
	const order = Array.isArray(module['__namedExportsOrder']) ? (module['__namedExportsOrder'] as string[]) : Object.keys(module);
	const names = order.filter((name) => name !== 'default' && isStory(module[name]));

	return [...names.filter((name) => name === 'Default'), ...names.filter((name) => name !== 'Default')];
}

/** First paragraph of a markdown description, skipping headings */
export function firstParagraph(markdown?: string): string | undefined {
	return markdown
		?.split(/\n\s*\n/)
		.map((block) => block.trim())
		.find((block) => block && !block.startsWith('#'))
		?.replace(/\s+/g, ' ');
}

function toStoryDoc(meta: CsfAnnotations, componentId: string, exportName: string, story: CsfAnnotations): StoryDoc | undefined {
	const render = story.render ?? meta.render ?? (meta.component ? defaultRender(meta.component) : undefined);

	if (!render) return undefined;

	const name = story.name ?? storyNameFromExport(exportName);

	return {
		id: toSlug(name),
		exportName,
		name,
		componentId,
		description: story.parameters?.docs?.description?.story,
		args: { ...meta.args, ...story.args },
		argTypes: { ...meta.argTypes, ...story.argTypes },
		render,
		decorators: [...asArray(story.decorators), ...asArray(meta.decorators)],
		parameters: { ...meta.parameters, ...story.parameters },
	};
}

/** Turns a CSF module into a component with its stories, in export order */
export function toComponentDoc(module: StoryModule): ComponentDoc | undefined {
	const meta = module.default;

	if (!meta?.title) return undefined;

	const title = titleLeaf(meta.title);
	const id = toSlug(title);
	const description = meta.parameters?.docs?.description?.component?.trim();
	const stories = storyExportNames(module)
		.map((exportName) => toStoryDoc(meta, id, exportName, module[exportName] as CsfAnnotations))
		.filter((story): story is StoryDoc => !!story);

	if (!stories.length) return undefined;

	return { id, title, path: meta.title, component: meta.component, description, summary: firstParagraph(description), stories };
}
