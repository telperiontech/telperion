/**
 * Shape of `docs-model.json`, generated from the js-utils sources by
 * `apps/osw/js-utils/scripts/generate-docs-model`. Shared by the generator and the UI.
 */

export type DeclarationKind = 'function' | 'class' | 'variable' | 'type' | 'interface' | 'enum';

export interface DocsTag {
	name: string;
	text: string;
}

/** One exported declaration, with its TSDoc split into renderable parts */
export interface DocsDeclaration {
	name: string;
	kind: DeclarationKind;
	/** `#### Heading` from the doc comment, or the export name */
	title: string;
	/** First prose paragraph, plain text */
	summary: string;
	/** Full doc comment body as markdown (heading and tags removed) */
	description: string;
	/** Printed declaration signatures (overloads, class shape, type text) */
	signatures: string[];
	params: DocsTag[];
	templates: DocsTag[];
	returns?: string;
	see: string[];
}

/** A `proto/` or `static/` module that patches a global with the entry's function */
export interface DocsExtension {
	kind: 'prototype' | 'static';
	/** Patched global, e.g. `Array`, `Promise` */
	target: string;
	/** Patched member names, e.g. `difference` */
	members: string[];
	importPath: string;
	sourcePath: string;
	/** Printed `interface X { ... }` augmentation, comments removed */
	signature: string;
	/** Doc comment of the augmented member, when it has its own */
	description: string;
}

/** One importable module, e.g. `@telperion/js-utils/array/difference` */
export interface DocsEntry {
	/** Module path inside the package, also the docs URL path: `array/difference` */
	id: string;
	category: string;
	importPath: string;
	sourcePath: string;
	primary: DocsDeclaration;
	related: DocsDeclaration[];
	extensions: DocsExtension[];
}

export interface DocsCategory {
	id: string;
	title: string;
	description: string;
	entryIds: string[];
}

export interface DocsModel {
	packageName: string;
	version: string;
	generatedAt: string;
	categories: DocsCategory[];
	entries: DocsEntry[];
}
