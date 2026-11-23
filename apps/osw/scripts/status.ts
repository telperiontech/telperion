/**
 * Prints this developer's osw URLs, checks the frpc container, the tunnel (frpc's logs since its last
 * login) and requests each public URL once. Never prints the token or the compose config.
 *
 * Usage: nx run osw:status
 */
import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
// Relative: plain `node -r @swc-node/register` does not apply tsconfig paths
import { DEV_ENV_FILE, DevEnvError, readDevIdentity, type DevIdentity } from '../kit/build/src/dev/identity';
import { COMPOSE } from './compose';
import { devApps, devUrl } from './dev-apps';

const REQUEST_TIMEOUT_MS = 20_000; // the first request for a name waits for its certificate
const WIDTH = 20;
const ok = (text: string) => console.log(`  [ok]   ${text}`);
const bad = (text: string) => console.log(`  [FAIL] ${text}`);
const warn = (text: string) => console.log(`  [warn] ${text}`);
// frp colours its console log even without a TTY; `--no-color` only affects compose's prefix
const ANSI = /\x1b\[[0-9;]*m/g;

function docker(args: string[], options: SpawnSyncOptions = {}) {
	return spawnSync('docker', [...COMPOSE, ...args], { encoding: 'utf8', ...options });
}

function checkContainer(): boolean {
	console.log('\nContainer (compose project osw)');

	const result = docker(['ps', '--all', '--format', 'json', 'frpc']);

	if (result.error || result.status !== 0) {
		bad('could not run `docker compose ps`. Is Docker running?');

		return false;
	}

	// One JSON object per line (Compose v2.21+), or a single JSON array (older versions)
	const container = String(result.stdout)
		.split(/\r?\n/)
		.filter((line) => line.trim())
		.flatMap((line) => {
			try {
				return [JSON.parse(line)].flat();
			} catch {
				return [];
			}
		})
		.find((entry) => entry.Service === 'frpc');

	if (!container) {
		bad('frpc is not created. Run `nx run osw:mediator`.');

		return false;
	}

	const text = `frpc ${container.State}, ${container.Status}`;

	if (container.State !== 'running') {
		bad(text);

		return false;
	}

	// The healthcheck only checks that the process runs; the login is checked from the logs below
	ok(text);

	return true;
}

function checkTunnel(identity: DevIdentity, proxies: string[]): boolean {
	console.log('\nTunnel (frpc logs since the last login attempt)');

	const result = docker(['logs', '--no-log-prefix', '--no-color', 'frpc'], { maxBuffer: 64 * 1024 * 1024 });

	if (result.error || result.status !== 0) {
		bad(String(result.error?.message ?? result.stderr ?? 'docker compose logs failed').trim());
		console.log('         Is the mediator up? Run `nx run osw:mediator`.');

		return false;
	}

	const lines = `${result.stdout}${result.stderr}`.replace(ANSI, '').split(/\r?\n/);
	// Last attempt: frp's "try to connect/reconnect" or "start frpc service" line; the image's "Starting FRP
	// client..." line (after its banner and config print) when frpc stopped before logging anything
	let start = -1;

	lines.forEach((line, index) => {
		if (/try to (re)?connect to server|start frpc service|^Starting FRP client/i.test(line)) start = index;
	});

	const recent = start >= 0 ? lines.slice(start) : lines;
	let allGood = true;

	if (recent.some((line) => /login to server success/i.test(line))) {
		ok(`logged in to ${identity.server.addr}:${identity.server.port}`);
	} else {
		allGood = false;
		bad('no successful login');
	}

	for (const proxy of proxies) {
		if (recent.some((line) => line.includes(`[${proxy}]`) && /start proxy success/i.test(line))) {
			ok(`proxy ${proxy}: start proxy success`);
		} else {
			allGood = false;
			bad(`proxy ${proxy}: no "start proxy success"`);
		}
	}

	const problems = recent.filter((line) => /\[(E|W)\]|error|refused|not granted|already exists|failed/i.test(line));

	if (problems.length) {
		console.log('\n  Recent errors and warnings from frpc:');
		problems.slice(-10).forEach((line) => console.log(`    ${line.trim()}`));
	}

	if (!allGood) {
		console.log(`
  Hints:
    - "not granted": the name is outside *.<you>.${identity.zone}; check FRP_GATE_USER and OSW_DEV_ZONE.
    - "unknown client or invalid token" / login refused: FRP_GATE_TOKEN is wrong or the client is disabled; ask the admin.
    - "proxy already exists": another machine runs with the same DEV_DEVICE (give each device its own).
    - a proxy missing from the list: a new remote; run \`nx run osw:mediator\` again.
    - after editing ${DEV_ENV_FILE}: \`nx run osw:mediator\` (recreates frpc), then restart \`nx run osw:serve\`.`);
	}

	return allGood;
}

async function checkUrl(label: string, url: string): Promise<boolean> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		const { status } = await fetch(url, { redirect: 'manual', signal: controller.signal });

		// 502/504 from the gateway: the tunnel is up but the local dev server is not answering
		if (status >= 502 && status <= 504) {
			warn(`${label.padEnd(WIDTH)} ${url} -> ${status} (gateway reached; is \`nx run osw:serve\` running?)`);

			return false;
		}

		(status < 400 ? ok : warn)(`${label.padEnd(WIDTH)} ${url} -> ${status}`);

		return status < 400;
	} catch (error) {
		const reason = (error as Error).name === 'AbortError'
			? `timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
			: ((error as { cause?: { code?: string } }).cause?.code ?? (error as Error).message);

		bad(`${label.padEnd(WIDTH)} ${url} -> ${reason}`);

		if (/TLSV1_ALERT|SSL/.test(String(reason))) {
			console.log('         (the gateway issues no certificate for a name your frpc has not claimed: check the tunnel above)');
		}

		return false;
	} finally {
		clearTimeout(timer);
	}
}

async function main(): Promise<void> {
	const identity = readDevIdentity();
	const apps = await devApps();

	console.log(`Developer: ${identity.user}, device: ${identity.device}\n\nPublic (via frp-gate)`);
	apps.forEach((app) => console.log(`  ${app.project.padEnd(WIDTH)} ${devUrl(identity, app).padEnd(64)} <- localhost:${app.port}`));

	if (!identity.hasToken) {
		console.log('');
		bad(`FRP_GATE_TOKEN is empty in ${DEV_ENV_FILE}`);
	}

	const containerOk = checkContainer();
	const tunnelOk = checkTunnel(identity, apps.map((app) => `${app.proxy}-${identity.device}`));

	console.log('\nHTTPS requests (the first one per name can take a few seconds: certificate)');

	const results: boolean[] = [];

	for (const app of apps) results.push(await checkUrl(app.project, `${devUrl(identity, app)}${app.check}`));

	process.exitCode = containerOk && tunnelOk && !results.includes(false) ? 0 : 1;
}

main()
	// The Nx daemon connection opened by createProjectGraphAsync keeps the process alive
	.then(() => process.exit())
	.catch((error) => {
		console.error(error instanceof DevEnvError ? error.message : error);
		process.exit(1);
	});
