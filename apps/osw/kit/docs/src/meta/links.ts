export const REPO_URL = 'https://github.com/telperiontech/telperion';

/** Folder on GitHub, e.g. `libs/paintlet` */
export const treeUrl = (path: string) => `${REPO_URL}/tree/main/${path}`;
/** File on GitHub, e.g. `libs/js-utils/src/array/difference.ts` */
export const sourceUrl = (path: string) => `${REPO_URL}/blob/main/${path}`;
export const issuesUrl = () => `${REPO_URL}/issues`;
export const npmUrl = (packageName: string) => `https://www.npmjs.com/package/${packageName}`;
