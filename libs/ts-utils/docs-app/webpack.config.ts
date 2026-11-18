import { docsRemoteConfig, withSitemap } from '@osw/build';
import { sitemap } from './sitemap';

export default docsRemoteConfig('osw/ts-utils', withSitemap(sitemap));
