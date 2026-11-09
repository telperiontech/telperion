import { composePlugins, withNx } from '@nx/webpack';
import { withReact } from '@nx/react';
import { withModuleFederation } from '@nx/module-federation/webpack';
import { configureExtensions, configureWarnings, overrideMiniCssPluginOptions, overrideTsCompilerOptions } from '../utils/webpack-utils';

export default composePlugins(
  withNx({extractCss: false}),
  withReact({generateIndexHtml: false}),
  withModuleFederation({
    name: 'osw/js-utils',
    exposes: {
      './Docs': './src/Docs/index.tsx',
    },
  }, {
    dts: false,
    library: { type: 'module' }
  }),
  (config) => {
    // Ignore source map warnings from 3rd party libraries
    configureWarnings(config);

    // Resolve react and typescript extensions
    configureExtensions(config, ['.ts', '.tsx', '.js', '.jsx', '.json']);

    // CSS is injected via JS at runtime, so the remote ships its own styles with it
    overrideMiniCssPluginOptions(config, {runtime: false});

    // Override TypeScript compiler options for modern JavaScript output
    overrideTsCompilerOptions(config);

    return config;
  }
);
