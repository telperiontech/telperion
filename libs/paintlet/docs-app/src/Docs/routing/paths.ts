import { treeUrl } from '@osw/docs';

/** Mount path of this remote in the shell; must match the shell's `<tha-route>` */
export const BASE_PATH = '/paintlet';

export const homePath = () => BASE_PATH;
export const paintletPath = (paintletId: string) => `${BASE_PATH}/${paintletId}`;
export const storyPath = (paintletId: string, storyId: string) => `${BASE_PATH}/${paintletId}/${storyId}`;

export const SOURCE_URL = treeUrl('libs/paintlet');
