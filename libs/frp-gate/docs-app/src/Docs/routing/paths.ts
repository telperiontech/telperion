import { treeUrl } from '@osw/docs';
import { BASE_PATH } from '../base-path';

export { BASE_PATH };

export const homePath = () => BASE_PATH;
export const pagePath = (slug: string) => `${BASE_PATH}/${slug}`;

export const SOURCE_URL = treeUrl('libs/frp-gate');
