/**
 * Node side of `@osw/api`: builds `docs-model.json` from a library's TypeScript sources.
 * Docs remotes import this relatively from their generator script (see `generate.ts`).
 */
export type { ApiCategoryMeta, ApiModelConfig } from './config';
export { buildModel } from './build-model';
export { generateApiModel } from './generate';
