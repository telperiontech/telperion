import { Compilation, sources, type Compiler, type Configuration } from 'webpack';
import { REMOTE_ROBOTS_TXT, renderSitemap, shellOrigin } from './render';

export interface SitemapOptions {
	/** Shell paths of the remote's indexable pages, e.g. `['/js-utils', '/js-utils/array/difference']` */
	paths: () => Iterable<string>;
	/** Files `paths` reads (e.g. a generated docs model), so watch mode re-emits when they change */
	dependencies?: string[];
}

const PLUGIN_NAME = 'OswSitemapPlugin';

/**
 * Emits `sitemap.xml` and `robots.txt` at the root of a docs remote's build.
 *
 * The sitemap lists URLs on the shell's origin while living on the remote's host, so each
 * remote republishes its own page list on deploy without a shell release. Crawlers accept
 * this because the shell's `robots.txt` links to it (cross-site sitemap submission).
 */
export class SitemapPlugin {
	constructor(private readonly options: SitemapOptions) {}

	apply(compiler: Compiler): void {
		compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
			this.options.dependencies?.forEach((file) => compilation.fileDependencies.add(file));

			compilation.hooks.processAssets.tap({ name: PLUGIN_NAME, stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL }, () => {
				compilation.emitAsset('sitemap.xml', new sources.RawSource(renderSitemap(shellOrigin(), this.options.paths())));
				compilation.emitAsset('robots.txt', new sources.RawSource(REMOTE_ROBOTS_TXT));
			});
		});
	}
}

/** `docsRemoteConfig` step adding a {@link SitemapPlugin} */
export const withSitemap =
	(options: SitemapOptions) =>
	(config: Configuration): void => {
		config.plugins ??= [];
		config.plugins.push(new SitemapPlugin(options));
	};
