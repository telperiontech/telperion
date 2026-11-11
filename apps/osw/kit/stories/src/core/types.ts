/**
 * The subset of Storybook's Component Story Format (CSF) the osw playgrounds understand.
 * Declared locally so remotes never bundle (or type-depend on) Storybook itself.
 */

export type Args = Record<string, unknown>;

export interface ArgType {
	control?: string | false | { type: string; min?: number; max?: number; step?: number };
	options?: readonly unknown[];
	description?: string;
	table?: {
		type?: { summary?: string };
		defaultValue?: { summary?: string };
		disable?: boolean;
	};
}

export type ArgTypes = Record<string, ArgType>;

export interface StoryContext {
	id: string;
	name: string;
	title: string;
	args: Args;
	argTypes: ArgTypes;
	parameters: Parameters;
}

export type RenderFn = (args: Args, context: StoryContext) => unknown;
export type Decorator = (story: () => unknown, context: StoryContext) => unknown;

/** Storybook's `parameters.layout` */
export type StoryLayout = 'centered' | 'padded' | 'fullscreen';

export interface Parameters {
	docs?: { description?: { component?: string; story?: string } };
	layout?: StoryLayout;
	[key: string]: unknown;
}

/** Annotations shared by a CSF `default` export (meta) and its named exports (stories) */
export interface CsfAnnotations {
	title?: string;
	name?: string;
	/** Custom element tag name the stories document, e.g. `tp-button` */
	component?: string;
	args?: Args;
	argTypes?: ArgTypes;
	render?: RenderFn;
	decorators?: Decorator | Decorator[];
	parameters?: Parameters;
	tags?: string[];
}

export type StoryModule = { default: CsfAnnotations } & Record<string, unknown>;

/** A story with meta-level annotations merged in, ready to render */
export interface StoryDoc {
	/** URL segment, e.g. `heavy-rain` */
	id: string;
	exportName: string;
	name: string;
	componentId: string;
	description?: string;
	args: Args;
	argTypes: ArgTypes;
	render: RenderFn;
	/** Innermost first: story decorators, then meta decorators */
	decorators: Decorator[];
	parameters: Parameters;
}

/** One stories file: a component (paintlet, element, …) and its stories */
export interface ComponentDoc {
	/** URL segment, e.g. `low-poly-mesh` */
	id: string;
	/** Display name, e.g. `Low Poly Mesh` */
	title: string;
	/** Full CSF title, e.g. `Paintlets/Low Poly Mesh` */
	path: string;
	/** Custom element tag name from the meta's `component`, when there is one */
	component?: string;
	/** First paragraph of the component description */
	summary?: string;
	/** Full component description (markdown) */
	description?: string;
	stories: StoryDoc[];
}
