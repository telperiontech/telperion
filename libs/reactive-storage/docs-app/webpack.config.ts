import { docsRemoteConfig, withSitemap } from '@osw/build';
import { sitemap } from './sitemap';

export default docsRemoteConfig('osw/reactive-storage', withSitemap(sitemap));
