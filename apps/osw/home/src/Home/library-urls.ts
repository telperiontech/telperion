import type { Library } from './libraries';

export const REPO_URL = 'https://github.com/telperiontech/telperion';

/** npm package page; `library.name` carries the package's current scope */
export const npmUrl = (library: Library) => `https://www.npmjs.com/package/${library.name}`;

export const npmVersionBadge = (library: Library) =>
	`https://img.shields.io/npm/v/${library.name}.svg?style=flat-square`;

export const npmDownloadsBadge = (library: Library) =>
	`https://img.shields.io/npm/dm/${library.name}.svg?style=flat-square`;

/** Library source folder in the monorepo */
export const sourceUrl = (library: Library) => `${REPO_URL}/tree/main/libs/${library.packageName}`;

/** GitHub Container Registry package page for docker libraries */
export const ghcrUrl = (library: Library) => {
	const [owner, name] = (library.image ?? '').split('/');
	return `https://github.com/orgs/${owner}/packages/container/package/${name}`;
};

/** Shields static badges use `-` as a separator, so literal dashes must be doubled */
const shieldsText = (text: string) => encodeURIComponent(text.replace(/-/g, '--'));

export const ghcrBadge = (library: Library) =>
	`https://img.shields.io/badge/ghcr.io-${shieldsText(library.image ?? '')}-blue?style=flat-square&logo=docker`;

/** Primary registry link: npm for packages, GHCR for docker images */
export const registryUrl = (library: Library) => (library.type === 'npm' ? npmUrl(library) : ghcrUrl(library));
