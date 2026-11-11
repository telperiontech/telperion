import { treeUrl } from '@osw/docs';

/** Mount path of this remote in the shell; must match the shell's `<tha-route>` */
export const BASE_PATH = '/elements';

export const homePath = () => BASE_PATH;
/** Docs URLs mirror entry points: `@telperion/elements/button` → `/elements/button` */
export const entryPath = (entryId: string) => `${BASE_PATH}/${entryId}`;
export const elementAnchor = (tagName: string) => `#${tagName}`;
export const storyPath = (entryId: string, storyId: string) => `${BASE_PATH}/${entryId}/${storyId}`;

export const SOURCE_URL = treeUrl('libs/elements');
