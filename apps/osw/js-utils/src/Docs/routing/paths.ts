/** Mount path of this remote in the shell; must match the shell's `<tha-route>` */
export const BASE_PATH = '/js-utils';

export const overviewPath = () => BASE_PATH;

/** Docs URLs mirror import paths: `@telperion/js-utils/array/difference` → `/js-utils/array/difference` */
export const docsPath = (id: string) => `${BASE_PATH}/${id}`;

export const REPO_URL = 'https://github.com/telperiontech/telperion';
export const sourceUrl = (sourcePath: string) => `${REPO_URL}/blob/main/${sourcePath}`;
export const npmUrl = (packageName: string) => `https://www.npmjs.com/package/${packageName}`;
