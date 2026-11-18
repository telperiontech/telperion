/**
 * Starts the local HTTPS gateway (docker-compose.mediator.yml) that serves every osw app
 * on its own `*.open-source.telperion.local` origin, like production.
 *
 * The proxy list is derived from the Nx workspace: every `scope:osw` project with a
 * `serve/app` target is proxied from its `publicHost` to its dev-server `port`, so a new
 * remote needs no change here.
 *
 * Usage: nx run osw:mediator
 */
const { execSync } = require('node:child_process');
const { join } = require('node:path');
const { createProjectGraphAsync } = require('@nx/devkit');

const COMPOSE_FILE = join(__dirname, '../docker-compose.mediator.yml');

async function staticProxies() {
	const graph = await createProjectGraphAsync({ exitOnError: true });

	return Object.values(graph.nodes)
		.filter((node) => node.data.tags?.includes('scope:osw') && node.data.targets?.['serve/app'])
		.map((node) => {
			const { publicHost, port } = node.data.targets['serve/app'].options ?? {};

			if (!publicHost || !port) throw new Error(`${node.name}: serve/app needs "publicHost" and "port"`);

			return `HTTP:::${new URL(publicHost).hostname}:::443=>host.docker.internal:::${port}`;
		})
		.sort();
}

staticProxies()
	.then((proxies) => {
		proxies.forEach((proxy) => console.log(`mediator: ${proxy}`));
		execSync(`docker compose -f "${COMPOSE_FILE}" up --build -d`, {
			stdio: 'inherit',
			env: {
				...process.env,
				OSW_STATIC_PROXIES: proxies.join(','),
				// Compose builds through `buildx bake`, which refuses to read the gateway's build context
				// (libs/auto-proxy) because it lies outside the compose file's folder; that path is ours
				BUILDX_BAKE_ENTITLEMENTS_FS: '0',
			},
		});
		// The Nx daemon connection opened by createProjectGraphAsync keeps the process alive
		process.exit(0);
	})
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
