import { DefinePlugin } from 'webpack';
import { docsRemoteConfig, resolveVersion, withSitemap } from '@osw/build';
import { sitemap } from './sitemap';

export default docsRemoteConfig(
  'osw/paintlet',
  (config) => {
    config.plugins?.push(new DefinePlugin({ __PAINTLET_VERSION__: JSON.stringify(resolveVersion('paintlet-v')) }));
  },
  withSitemap(sitemap),
);
