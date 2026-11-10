/**
 * The subset of Storybook's Component Story Format the playground understands.
 * Declared locally so the remote never bundles (or type-depends on) Storybook itself.
 */

export type Args = Record<string, unknown>;

export interface ArgType {
	control?: string | false | { type: string; min?: number; max?: number; step?: number };
	options?: readonly unknown[];
	description?: string;
	table?: {
		type?: { summary?: string };
		defaultValue?: { summary?: string };
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

export interface Parameters {
	docs?: { description?: { component?: string; story?: string } };
	[key: string]: unknown;
}

/** Annotations shared by a CSF `default` export (meta) and its named exports (stories) */
export interface CsfAnnotations {
	title?: string;
	name?: string;
	args?: Args;
	argTypes?: ArgTypes;
	render?: RenderFn;
	decorators?: Decorator | Decorator[];
	parameters?: Parameters;
}

export type StoryModule = { default: CsfAnnotations } & Record<string, unknown>;

/** A story with meta-level annotations merged in, ready to render */
export interface StoryDoc {
	/** URL segment, e.g. `heavy-rain` */
	id: string;
	exportName: string;
	name: string;
	paintletId: string;
	description?: string;
	args: Args;
	argTypes: ArgTypes;
	render: RenderFn;
	/** Innermost first: story decorators, then meta decorators */
	decorators: Decorator[];
	parameters: Parameters;
}

/** One stories file: a paintlet and its stories */
export interface PaintletDoc {
	/** URL segment, e.g. `low-poly-mesh` */
	id: string;
	/** Display name, e.g. `Low Poly Mesh` */
	title: string;
	/** First paragraph of the component description */
	summary?: string;
	/** Full component description (markdown) */
	description?: string;
	stories: StoryDoc[];
}
