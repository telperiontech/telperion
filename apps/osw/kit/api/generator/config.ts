export interface ApiCategoryMeta {
	title: string;
	description: string;
}

/** Per-library settings of the API model generator */
export interface ApiModelConfig {
	/** Absolute path of the workspace root */
	workspaceRoot: string;
	/** Workspace-relative library folder, e.g. `libs/js-utils`; sources are read from its `src` via `tsconfig.lib.json` */
	libRoot: string;
	/** Published package name, e.g. `@telperion/js-utils` */
	packageName: string;
	/** Release tag prefix used to resolve the version when `PACKAGE_VERSION` is unset, e.g. `js-utils-v` */
	tagPrefix: string;
	/** Workspace-relative output path of `docs-model.json` (overridable with `--out`) */
	out: string;
	/** Category of root-level modules (`<package>/limit`). Defaults to `core` */
	rootCategory?: string;
	/** Display order and copy for categories; unknown folders are appended with a generated title */
	categories?: Record<string, ApiCategoryMeta>;
}

export const sourceRoot = (config: ApiModelConfig) => `${config.libRoot}/src`;
export const rootCategory = (config: ApiModelConfig) => config.rootCategory ?? 'core';
