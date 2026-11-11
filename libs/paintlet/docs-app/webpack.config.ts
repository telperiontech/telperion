import { DefinePlugin } from 'webpack';
import { docsRemoteConfig, resolveVersion } from '@osw/build';

export default docsRemoteConfig('osw/paintlet', (config) => {
  config.plugins?.push(new DefinePlugin({ __PAINTLET_VERSION__: JSON.stringify(resolveVersion('paintlet-v')) }));
});
