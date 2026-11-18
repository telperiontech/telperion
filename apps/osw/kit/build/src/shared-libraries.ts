/** Kit libraries that are stateless and differ per remote, so each remote bundles its own copy */
const BUNDLED_KIT_LIBRARIES = ['@osw/api', '@osw/docs', '@osw/stories', '@osw/stories/core'];

/**
 * Packages whose entry points must come from one unsplit copy. `rxjs/testing`'s `TestScheduler`
 * patches rxjs' internal scheduler providers; shared, each entry point is tree-shaken on its own
 * and the providers it reaches for are missing.
 */
const BUNDLED_PACKAGES = ['rxjs'];

const isBundledPackage = (libraryName: string) =>
	BUNDLED_PACKAGES.some((name) => libraryName === name || libraryName.startsWith(`${name}/`));

/**
 * `shared` option for the docs remotes' `withModuleFederation`.
 *
 * Production builds tree-shake a provided shared module down to the exports its own remote
 * uses, and the federation runtime may hand any remote the copy another remote provided.
 * That is unsafe for the docs kits, whose remotes each use a different subset; they keep no
 * state either, so they are simply not shared. The same goes for {@link BUNDLED_PACKAGES}.
 */
export function oswShared<T>(libraryName: string, sharedConfig: T): T | false {
	return BUNDLED_KIT_LIBRARIES.includes(libraryName) || isBundledPackage(libraryName) ? false : sharedConfig;
}
