/** Kit libraries that are stateless and differ per remote, so each remote bundles its own copy */
const BUNDLED_KIT_LIBRARIES = ['@osw/docs', '@osw/stories', '@osw/stories/core'];

/**
 * `shared` option for the docs remotes' `withModuleFederation`.
 *
 * Production builds tree-shake a provided shared module down to the exports its own remote
 * uses, and the federation runtime may hand any remote the copy another remote provided.
 * That is unsafe for the docs kits, whose remotes each use a different subset; they keep no
 * state either, so they are simply not shared.
 */
export function oswShared<T>(libraryName: string, sharedConfig: T): T | false {
	return BUNDLED_KIT_LIBRARIES.includes(libraryName) ? false : sharedConfig;
}
