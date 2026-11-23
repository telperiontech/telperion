/**
 * Shape of `generated/docs-model.json`, written by `scripts/generate-docs-model` from the
 * README, the Go sources and `examples/`. React-free: the generator imports it.
 */

/** How a page's body is rendered: README prose, or a reference generated from Go */
export type PageKind = 'guide' | 'env' | 'api' | 'cli' | 'config-file' | 'examples';

export interface Page {
	/** URL segment below the base path */
	slug: string;
	title: string;
	kind: PageKind;
	/** First sentence of the page, for cards and the meta description */
	summary: string;
	/** Prose shown above (or as) the page body; links already point at docs routes */
	markdown: string;
	/** `###` headings of `markdown`, for the in-page outline */
	headings: { id: string; text: string }[];
}

export interface NavGroup {
	title: string;
	slugs: string[];
}

/** One `FRP_GATE_*` variable read in `internal/config` */
export interface EnvVar {
	name: string;
	/** Default from the Go source; `undefined` when there is none */
	default?: string;
	required: boolean;
	/** `NAME_FILE` reads the value from a file (Docker secrets) */
	fileVariant: boolean;
	/** From the README's Configuration table */
	description: string;
}

export interface ApiRoute {
	method: 'GET' | 'POST' | 'PUT' | 'DELETE';
	/** Below `/api/v1/`, e.g. `clients/{name}` */
	path: string;
	/** Handler doc comment, without the handler name */
	description: string;
	/** JSON body fields the handler reads */
	body: string[];
	/** Query parameters the handler reads */
	query: string[];
	/** Success status code */
	status: number;
	/** Top-level keys of the success answer; `undefined` when it is a single object */
	result?: string[];
}

export interface ApiGroup {
	/** First path segment, e.g. `clients` */
	resource: string;
	routes: ApiRoute[];
}

export interface CliFlag {
	name: string;
	type: 'string' | 'bool';
	default: string;
	description: string;
}

export interface CliCommand {
	/** `''` for the server itself (no command) */
	name: string;
	/** e.g. `apply [-f FILE] [--dry-run]` */
	synopsis: string;
	/** One line from the usage text */
	summary: string;
	/** Doc comment of the command's Go function */
	details: string;
	flags: CliFlag[];
}

export interface ConfigField {
	key: string;
	/** YAML-ish type, e.g. `list of strings`, `map of InstanceSpec` */
	type: string;
	required: boolean;
	/** Trailing Go comment, when the field has one */
	description: string;
}

/** One struct of the declarative config file (`internal/declare/file.go`) */
export interface ConfigType {
	/** Go struct name, e.g. `InstanceSpec` */
	name: string;
	/** Where it sits in the file: `''` for the top level, `instances.<name>`, `grants[]` */
	path: string;
	description: string;
	fields: ConfigField[];
}

export interface Example {
	/** Path below `examples/` */
	path: string;
	language: string;
	code: string;
	/** From the README's Quick start table */
	description: string;
}

export interface DocsModel {
	name: string;
	/** GHCR image, `owner/name` */
	image: string;
	version: string;
	/** README text above the contents, as markdown */
	intro: string;
	pages: Page[];
	nav: NavGroup[];
	env: EnvVar[];
	api: ApiGroup[];
	cli: CliCommand[];
	configFile: ConfigType[];
	examples: Example[];
}
