import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'dotenv';

/**
 * Developer identity for the frp-gate dev environment, read from `.workspace/dev.env`
 * (gitignored; see `.workspace/dev.env.example`). Shared by the dev servers' webpack config,
 * `nx run osw:mediator`, `nx run osw:status` and the shell's `generate-remotes`.
 *
 * The frp-gate server and the dev zone are the operator's, given to each developer with their
 * client name and token; none of them is committed. Never logs or returns `FRP_GATE_TOKEN`.
 */

/** Workspace-relative path of the identity file */
export const DEV_ENV_FILE = '.workspace/dev.env';

export interface DevIdentity {
	/** frp-gate client name (the frpc `user`), e.g. `alice` */
	user: string;
	/** This machine, unique among the developer's devices, e.g. `pc` */
	device: string;
	hasToken: boolean;
	/** frps address frpc logs in to (`FRP_GATE_SERVER_ADDR`, `FRP_GATE_SERVER_PORT`) */
	server: { addr: string; port: number };
	/** frp-gate zone of the osw apps (`OSW_DEV_ZONE`), e.g. `dev.example.com` */
	zone: string;
	/** `<device>.<user>.<zone>`: the shell's host and the remotes' parent domain */
	base: string;
}

export class DevEnvError extends Error {}

const DNS_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const isDomain = (value: string) => value.split('.').length > 1 && value.split('.').every((label) => DNS_LABEL.test(label));

/** Walks up from the current directory to the workspace root (the folder with `nx.json`) */
function workspaceRoot(): string {
	let dir = process.cwd();

	while (!existsSync(join(dir, 'nx.json'))) {
		const parent = join(dir, '..');

		if (parent === dir) throw new DevEnvError('Could not find the workspace root (nx.json)');
		dir = parent;
	}

	return dir;
}

export function devEnvPath(root = workspaceRoot()): string {
	return join(root, DEV_ENV_FILE);
}

/** Reads and validates `.workspace/dev.env`. Throws {@link DevEnvError} when it is missing or invalid. */
export function readDevIdentity(root = workspaceRoot()): DevIdentity {
	const path = devEnvPath(root);

	if (!existsSync(path)) {
		throw new DevEnvError(`Missing ${DEV_ENV_FILE}. Copy .workspace/dev.env.example to ${DEV_ENV_FILE} and fill it in.`);
	}

	const env = parse(readFileSync(path, 'utf8'));
	const value = (key: string) => (env[key] ?? '').trim();
	const [user, device, addr, zone] = ['FRP_GATE_USER', 'DEV_DEVICE', 'FRP_GATE_SERVER_ADDR', 'OSW_DEV_ZONE'].map(value);
	const port = Number(value('FRP_GATE_SERVER_PORT'));
	const problems: string[] = [];

	if (!DNS_LABEL.test(user)) problems.push(`FRP_GATE_USER must be a lowercase DNS label (a-z, 0-9, -), got "${user}"`);
	if (!DNS_LABEL.test(device)) problems.push(`DEV_DEVICE must be a lowercase DNS label (a-z, 0-9, -), got "${device}"`);
	if (!addr) problems.push('FRP_GATE_SERVER_ADDR is empty (the frp-gate server, from the admin)');
	if (!Number.isInteger(port) || port < 1 || port > 65535) problems.push('FRP_GATE_SERVER_PORT must be a port number (from the admin)');
	if (!isDomain(zone)) problems.push(`OSW_DEV_ZONE must be a lowercase domain (the osw dev zone, from the admin), got "${zone}"`);
	if (problems.length) throw new DevEnvError(`Invalid ${DEV_ENV_FILE}:\n  - ${problems.join('\n  - ')}`);

	return {
		user,
		device,
		hasToken: Boolean(value('FRP_GATE_TOKEN')),
		server: { addr, port },
		zone,
		base: `${device}.${user}.${zone}`,
	};
}

/** Public host of an osw app: the shell (no subdomain) at `<base>`, a remote at `<subdomain>.<base>` */
export function devHost(identity: DevIdentity, subdomain?: string): string {
	return subdomain ? `${subdomain}.${identity.base}` : identity.base;
}
