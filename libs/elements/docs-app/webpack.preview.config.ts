import { composePlugins, withNx, withWeb } from '@nx/webpack';
import { configureSwcForLit, configureWarnings, overrideTsCompilerOptions, skipWorkspaceLicense } from '@osw/build';

/**
 * The preview page the stories run in (see src/protocol/messages.ts).
 *
 * A plain web build, deliberately outside module federation: the page is standalone, and
 * consuming shared modules there lets Lit's sub-packages and the elements' own import cycles
 * initialize out of order. `build/app` copies the output into the remote under `preview/`.
 */
export default composePlugins(withNx({}), withWeb(), (config) => {
	configureWarnings(config);
	overrideTsCompilerOptions(config);
	configureSwcForLit(config);
	skipWorkspaceLicense(config);

	return config;
});
