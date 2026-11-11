import type { Library } from './libraries';

export const REPO_URL = 'https://github.com/telperiontech/telperion';

/** npm package page; `library.name` carries the package's current scope */
export const npmUrl = (library: Library) => `https://www.npmjs.com/package/${library.name}`;

/** Library source folder (and README) in the monorepo */
export const sourceUrl = (library: Library) => `${REPO_URL}/tree/main/libs/${library.packageName}`;

/** GitHub Container Registry package page for docker libraries */
export const ghcrUrl = (library: Library) => {
	const [owner, name] = (library.image ?? '').split('/');
	return `https://github.com/orgs/${owner}/packages/container/package/${name}`;
};

/** Primary registry link: npm for packages, GHCR for docker images */
export const registryUrl = (library: Library) => (library.type === 'npm' ? npmUrl(library) : ghcrUrl(library));

/** One-line install / pull command shown on cards */
export const installCommand = (library: Library) =>
	library.type === 'npm' ? `pnpm add ${library.name}` : `docker pull ghcr.io/${library.image}`;
