/**
 * The osw dev servers frpc tunnels, derived from the Nx workspace: every `scope:osw` project with a
 * `serve/app` port. The shell (`type:shell`) is served at `<base>`, every other app at `<name>.<base>`,
 * so a new remote needs no change here. Shared by mediator.ts and status.ts.
 */
import { createProjectGraphAsync } from '@nx/devkit';
// Relative: plain `node -r @swc-node/register` does not apply tsconfig paths
import { devHost, type DevIdentity } from '../kit/build/src/dev/identity';

export interface DevApp {
	/** Nx project, e.g. `osw/home` */
	project: string;
	/** Host label under the base domain; undefined for the shell */
	subdomain?: string;
	port: number;
	/** frpc proxy name without the `-<device>` suffix, e.g. `osw-home` */
	proxy: string;
	/** Path dev status requests: the shell's page, a remote's federation manifest */
	check: string;
}

export async function devApps(): Promise<DevApp[]> {
	const graph = await createProjectGraphAsync({ exitOnError: true });

	return Object.values(graph.nodes)
		.filter((node) => node.data.tags?.includes('scope:osw') && node.data.targets?.['serve/app'])
		.map((node) => {
			const port = node.data.targets?.['serve/app']?.options?.port;
			const shell = node.data.tags?.includes('type:shell');
			const subdomain = shell ? undefined : node.name.replace(/^osw\//, '');

			if (!port) throw new Error(`${node.name}: serve/app needs a "port"`);

			return { project: node.name, subdomain, port, proxy: `osw-${subdomain ?? 'shell'}`, check: shell ? '/' : '/mf-manifest.json' };
		})
		.sort((a, b) => a.port - b.port);
}

export const devUrl = (identity: DevIdentity, app: DevApp): string => `https://${devHost(identity, app.subdomain)}`;
