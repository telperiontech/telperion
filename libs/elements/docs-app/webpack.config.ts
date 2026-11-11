import { join } from 'node:path';
import type { Configuration, RuleSetRule } from 'webpack';
import { configureSwcForLit, docsRemoteConfig, skipWorkspaceLicense } from '@osw/build';

/** `*.stories.ts?meta` (the docs page's copy) loses its element-defining side-effect imports */
function stripStorySideEffects(config: Configuration): void {
	const rule: RuleSetRule = {
		test: /\.stories\.ts$/,
		resourceQuery: /meta/,
		enforce: 'pre',
		use: [{ loader: join(__dirname, 'scripts/webpack/strip-side-effect-imports.cjs') }],
	};

	config.module?.rules?.unshift(rule);
}

/**
 * `preview-url.ts` needs the runtime URL of its own chunk: webpack must neither inline
 * `import.meta.url` as the source path nor treat `new URL('preview/', import.meta.url)`
 * as an asset to bundle (the preview is a separate build, copied in by `build/app`).
 */
function keepRuntimeImportMeta(config: Configuration): void {
	config.module?.rules?.push({ test: /preview-frame[\\/]preview-url\.ts$/, parser: { importMeta: false, url: false } });
}

export default docsRemoteConfig(
	'osw/elements',
	(config) => configureSwcForLit(config, { react: true }),
	stripStorySideEffects,
	keepRuntimeImportMeta,
	skipWorkspaceLicense,
);
