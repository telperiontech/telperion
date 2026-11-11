/**
 * Shape of `elements-model.json`, generated from the Custom Elements Manifest and the
 * entry READMEs by `libs/elements/docs-app/scripts/generate-docs-model`.
 * Shared by the generator and the UI.
 */

export interface ApiAttribute {
	name: string;
	type?: string;
	default?: string;
	description?: string;
	/** Property the attribute reflects to, when it has one */
	fieldName?: string;
}

export interface ApiProperty {
	name: string;
	type?: string;
	default?: string;
	description?: string;
	readonly?: boolean;
	/** Attribute the property is bound to, when it has one */
	attribute?: string;
}

export interface ApiMethod {
	name: string;
	/** Printed signature, e.g. `selectOption(value: string): void` */
	signature: string;
	description?: string;
}

export interface ApiEvent {
	name: string;
	type?: string;
	description?: string;
}

export interface ApiNamed {
	name: string;
	description?: string;
	default?: string;
}

/** One custom element */
export interface ElementDoc {
	tagName: string;
	className: string;
	/** First prose paragraph of the class doc comment */
	summary: string;
	/** Full class doc comment (markdown, JSDoc tags removed) */
	description: string;
	sourcePath: string;
	attributes: ApiAttribute[];
	properties: ApiProperty[];
	methods: ApiMethod[];
	events: ApiEvent[];
	slots: ApiNamed[];
	cssProperties: ApiNamed[];
	cssParts: ApiNamed[];
	cssStates: ApiNamed[];
}

/** One entry point of the package, e.g. `@telperion/elements/button` */
export interface EntryDoc {
	/** Entry folder, also the docs URL segment: `button` */
	id: string;
	title: string;
	/** Short description for cards and the page lead */
	summary: string;
	importPath: string;
	sourcePath: string;
	/** The entry's README without the sections the API reference already covers (markdown) */
	guide?: string;
	elements: ElementDoc[];
}

export interface ElementsModel {
	packageName: string;
	version: string;
	generatedAt: string;
	/** IIFE bundle on a CDN, for `<script>` usage */
	cdnUrl: string;
	entries: EntryDoc[];
}
