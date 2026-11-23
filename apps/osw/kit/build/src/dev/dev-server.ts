import type { Configuration } from 'webpack';
import { DevEnvError, devHost, readDevIdentity } from './identity';

interface DevServerOptions {
	allowedHosts?: string[] | string;
	client?: false | { webSocketURL?: string | Record<string, unknown>; [key: string]: unknown };
	[key: string]: unknown;
}

/**
 * Points an osw dev server at its frp-gate tunnel: the page is served as `https://<host>` (TLS at the
 * gateway, frpc forwards plain HTTP to the dev server), so the HMR socket must use `wss://<host>:443`.
 * Host checks accept every name in the osw dev zone (`OSW_DEV_ZONE`): the shell (`<base>`) runs each
 * remote's HMR client, which connects to the remote's own host with the shell's Origin.
 *
 * `subdomain` is the remote's name (`home`, `js-utils`, ...); the shell passes none. Only applies while
 * serving (Nx passes `devServer` to the config then). Without `.workspace/dev.env` the dev server still
 * starts, on localhost only.
 */
export function configureDevServer(config: Configuration, subdomain?: string): void {
	const devServer = (config as { devServer?: DevServerOptions }).devServer;

	if (!devServer) return;

	let host: string;
	let zone: string;

	try {
		const identity = readDevIdentity();

		host = devHost(identity, subdomain);
		zone = identity.zone;
	} catch (error) {
		if (!(error instanceof DevEnvError)) throw error;
		console.warn(`osw dev server: ${error.message}\nServing on localhost only; the frp-gate tunnel will not reach it.`);
		return;
	}

	devServer.allowedHosts = [`.${zone}`, 'localhost'];
	devServer.client = {
		...(devServer.client || {}),
		webSocketURL: { protocol: 'wss', hostname: host, port: 443 },
	};
}
