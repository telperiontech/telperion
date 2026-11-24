import { composePlugins, withNx, withWeb } from '@nx/webpack';
import { withModuleFederation } from '@nx/module-federation/webpack';
import * as Dotenv from 'dotenv-webpack';
import { configureDevServer, configureWarnings, overrideTsCompilerOptions } from '@osw/build';

const config = composePlugins(
  withNx({}),
  withWeb(),
  withModuleFederation({
    name: 'osw/shell',
    // Remote modules are loaded dynamically at runtime. Checkout /src/assets/module-federation-manifest.json
    remotes: []
  }, {
    dts: false,
    library: { type: 'module' },
    // The default `version-first` initializes every registered remote (manifest + remoteEntry from
    // each host) before the first shared module resolves, so one page fetched all remotes and any
    // failure blanked it (seen in Googlebot's renderer). Remotes all declare 0.0.0, so comparing
    // versions gains nothing: reuse what is loaded and fetch only the remote the page needs.
    shareStrategy: 'loaded-first'
  }),
  (config, ctx) => {
    // Ignore source map warnings from 3rd party libraries
    configureWarnings(config);

    // Override TypeScript compiler options for modern JavaScript output
    overrideTsCompilerOptions(config);

    // Served as https://<base> through the frp-gate tunnel (HMR socket, host checks)
    configureDevServer(config);

    config.plugins.push(
      new Dotenv({
        path: 'apps/osw/shell/.env',
        prefix: 'import.meta.env.',
        // CI has no `.env`: values come from the workflow's environment
        systemvars: true,
        // Every documented key exists (empty when unset), so `import.meta.env.X` is never left untransformed
        defaults: 'apps/osw/shell/.env.template'
      })
    )

    return config;
  });

export default config;
