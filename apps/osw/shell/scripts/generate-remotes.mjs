/**
 * Writes the shell files that list its remotes, from `config/remotes.json`:
 *   - src/assets/module-federation.manifest.json  where to load each remote (`https://<name>.<OSW_DOMAIN>`)
 *   - src/generated/robots.txt                    the shell's and every remote's sitemap (production origins)
 *
 * `OSW_DOMAIN` comes from `apps/osw/shell/.env` (loaded by Nx) locally, and from the deploy workflow in CI.
 * Usage: node apps/osw/shell/scripts/generate-remotes.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHELL_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTION_DOMAIN = 'open-source.telperion.tr';
const { OSW_DOMAIN } = process.env;

if (!OSW_DOMAIN) {
	console.error('OSW_DOMAIN is not set: copy apps/osw/shell/.env.template to apps/osw/shell/.env');
	process.exit(1);
}

/** @type {{ name: string; sitemap?: boolean }[]} */
const remotes = JSON.parse(readFileSync(join(SHELL_ROOT, 'config/remotes.json'), 'utf8'));

function write(path, content) {
	const file = join(SHELL_ROOT, path);

	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, content);
	console.log(`generate-remotes: ${path}`);
}

const manifest = Object.fromEntries(remotes.map(({ name }) => [`osw/${name}`, `https://${name}.${OSW_DOMAIN}/mf-manifest.json`]));

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
