import registry from '../../config/remotes.json';

/**
 * One entry of `config/remotes.json`, the single list of the shell's remotes. Everything else
 * follows from the name: Nx project `osw/<name>`, origin `https://<name>.<OSW_DOMAIN>`,
 * element `<osw-<name>>`, exposed module `./Docs` and route `/<name>/…`.
 */
interface RemoteEntry {
	name: string;
	/** `<tp-route>` path; defaults to `/<name>{/*}?` (the remote's own pages) */
	route?: string;
	/** Exposed module mounted by the element; defaults to `Docs` */
	module?: string;
	/** Whether the remote publishes `/sitemap.xml` (listed in the shell's robots.txt); defaults to `true` */
	sitemap?: boolean;
}

export interface Remote {
	tagName: string;
	/** Federated module id, e.g. `osw/paintlet/Docs` */
	module: string;
	route: string;
}

export const REMOTES: Remote[] = (registry as RemoteEntry[]).map(({ name, route, module }) => ({
	tagName: `osw-${name}`,
	module: `osw/${name}/${module ?? 'Docs'}`,
	route: route ?? `/${name}{/*}?`,
}));
