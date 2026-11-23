/**
 * Writes the shell files that list its remotes, from `config/remotes.json`:
 *   - src/assets/module-federation.manifest.json  where to load each remote (`https://<name>.<domain>`)
 *   - src/generated/robots.txt                    the shell's and every remote's sitemap (production origins)
 *
 * The domain is `OSW_DOMAIN` when set (the deploy workflow in CI; locally optional, from `apps/osw/shell/.env`,
 * e.g. `open-source.telperion.tr` to load the production remotes), otherwise this developer's frp-gate
 * base domain from `.workspace/dev.env` (`<device>.<user>.<OSW_DEV_ZONE>`).
 *
 * Usage: node -r @swc-node/register apps/osw/shell/scripts/generate-remotes.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
// Relative: plain `node -r @swc-node/register` does not apply tsconfig paths
import { DevEnvError, readDevIdentity } from '../../kit/build/src/dev/identity';

const SHELL_ROOT = join(__dirname, '..');
const PRODUCTION_DOMAIN = 'open-source.telperion.tr';

function remotesDomain(): string {
	const override = process.env['OSW_DOMAIN']?.trim();

	if (override) return override;

	try {
		return readDevIdentity().base;
	} catch (error) {
		if (!(error instanceof DevEnvError)) throw error;
		console.error(`generate-remotes: OSW_DOMAIN is not set and ${error.message}`);
		process.exit(1);
	}
}

function write(path: string, content: string): void {
	const file = join(SHELL_ROOT, path);

	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, content);
	console.log(`generate-remotes: ${path}`);
}

const domain = remotesDomain();
const remotes: { name: string; sitemap?: boolean }[] = JSON.parse(readFileSync(join(SHELL_ROOT, 'config/remotes.json'), 'utf8'));
const manifest = Object.fromEntries(remotes.map(({ name }) => [`osw/${name}`, `https://${name}.${domain}/mf-manifest.json`]));

console.log(`generate-remotes: remotes from https://<name>.${domain}`);
write('src/assets/module-federation.manifest.json', JSON.stringify(manifest, null, 2) + '\n');

const robots = [
	'User-agent: *',
	'Allow: /',
	'',
	"# The shell's own pages",
	`Sitemap: https://${PRODUCTION_DOMAIN}/sitemap.xml`,
	'',
	'# Each remote publishes the list of its pages (on this origin) with its own deploy,',
	'# so new pages are listed without a shell release. Generated from config/remotes.json.',
	...remotes.filter((remote) => remote.sitemap !== false).map(({ name }) => `Sitemap: https://${name}.${PRODUCTION_DOMAIN}/sitemap.xml`),
	'',
];

write('src/generated/robots.txt', robots.join('\n'));
