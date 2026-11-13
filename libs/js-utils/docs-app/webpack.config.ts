import { docsRemoteConfig, withSitemap } from '@osw/build';
import { sitemap } from './sitemap';

export default docsRemoteConfig('osw/js-utils', withSitemap(sitemap));
