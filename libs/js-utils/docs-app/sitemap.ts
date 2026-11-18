import { join } from 'node:path';
import { apiSitemap } from '@osw/api/sitemap';
import { BASE_PATH } from './src/Docs/base-path';

export const sitemap = apiSitemap(BASE_PATH, join(__dirname, 'src/generated/docs-model.json'));
