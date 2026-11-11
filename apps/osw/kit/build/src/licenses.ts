import type { Configuration } from 'webpack';

const WORKSPACE_PACKAGE = '@telperion/telperion';

/**
 * The license extractor (production builds) resolves workspace sources outside any library,
 * such as a library's `.storybook` helpers, to the root package with an empty directory and
 * crashes reading it. Workspace code is not third-party, so the root package is skipped.
 */
export function skipWorkspaceLicense(config: Configuration): void {
	const plugin = config.plugins?.find((candidate) => candidate?.constructor.name === 'LicenseWebpackPlugin') as
		| { pluginOptions?: { excludedPackageTest?: (name: string) => boolean } }
		| undefined;

	if (!plugin) return;

	const previous = plugin.pluginOptions?.excludedPackageTest;

	plugin.pluginOptions = {
		...plugin.pluginOptions,
		excludedPackageTest: (name) => name === WORKSPACE_PACKAGE || !!previous?.(name),
	};
}
