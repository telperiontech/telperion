import { treeUrl } from '@osw/docs';

export { sourceUrl } from '@osw/docs';

/** Mount path of this remote in the shell; must match the shell's `<tha-route>` */
export const BASE_PATH = '/js-utils';

export const overviewPath = () => BASE_PATH;

/** Docs URLs mirror import paths: `@telperion/js-utils/array/difference` → `/js-utils/array/difference` */
export const docsPath = (id: string) => `${BASE_PATH}/${id}`;

export const SOURCE_URL = treeUrl('libs/js-utils');
