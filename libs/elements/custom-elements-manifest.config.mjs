import { tagNameMapDocsPlugin } from './cem/tag-name-map-docs-plugin.mjs';

/**
 * Custom Elements Manifest (https://custom-elements-manifest.open-wc.org) for @telperion/elements.
 * `nx run elements:analyze` writes `custom-elements.json`, which feeds the osw/elements docs
 * remote, Storybook's autodocs tables and IDE tooling (via the published package's
 * `customElements` field).
 */
export default {
  globs: ['src/**/*.ts'],
  exclude: ['src/**/*.spec.ts', 'src/**/*.stories.ts', 'src/**/index.ts'],
  outdir: '.',
  litelement: true,
  dependencies: false,
  packagejson: false,
  plugins: [tagNameMapDocsPlugin()],
};
