/**
 * Generates `docs-model.json` for the osw/frp-gate docs remote. frp-gate is written in Go,
 * so the model is read from its README (guides), its Go sources (references: environment,
 * JSON API, CLI, config file) and `examples/`. No Go toolchain is needed.
 *
 * Usage: node -r @swc-node/register libs/frp-gate/docs-app/scripts/generate-docs-model/main.ts [--out <path>] [--strict]
 *   --strict  exit with an error when the README and the code disagree, or a link does not resolve
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Relative: plain `node -r @swc-node/register` does not apply tsconfig paths
import { argValue, writeJson } from '../../../../../apps/osw/kit/build/src/model-cli';
import { resolveVersion } from '../../../../../apps/osw/kit/build/src/resolve-version';
import { REPO_URL } from '../../../../../apps/osw/kit/docs/src/meta/links';
import type { DocsModel } from '../../src/model/types';
import { apiGroups } from './api-routes';
import { cliCommands } from './cli';
import { configFileTypes } from './config-file';
import { envVars } from './env-vars';
import { examples } from './examples';
import { readPackage } from './go-source';
import { anchorRoutes, buildPages, pagePath } from './pages';
import { firstTable, parseReadme, rewriteMarkdown, type LinkContext } from './readme';

const WORKSPACE_ROOT = join(__dirname, '../../../../..');
const LIB = 'libs/frp-gate';
const LIB_ROOT = join(WORKSPACE_ROOT, LIB);
const OUT = argValue('--out') ?? join(LIB_ROOT, 'docs-app/src/generated/docs-model.json');
const strict = process.argv.includes('--strict');
const problems: string[] = [];
const readme = parseReadme(readFileSync(join(LIB_ROOT, 'README.md'), 'utf8'));
const section = (slug: string) => readme.sections.find((candidate) => candidate.slug === slug)?.body ?? '';
const links: LinkContext = {
	libRoot: LIB,
	workspaceRoot: WORKSPACE_ROOT,
	anchors: anchorRoutes(readme.sections),
	examplesPath: pagePath('examples'),
	repoUrl: REPO_URL,
	problems,
};
const { pages, nav } = buildPages(readme, links);
const model: DocsModel = {
	name: 'frp-gate',
	image: 'telperiontech/frp-gate',
	version: resolveVersion('frp-gate-v', WORKSPACE_ROOT),
	intro: rewriteMarkdown(readme.intro, links),
	pages,
	nav,
	env: envVars(readPackage(LIB_ROOT, 'internal/config'), firstTable(section('configuration')), problems).map((envVar) => ({
		...envVar,
		description: rewriteMarkdown(envVar.description, links),
	})),
	api: apiGroups(readPackage(LIB_ROOT, 'internal/admin'), problems),
	cli: cliCommands(readPackage(LIB_ROOT, 'cmd/frp-gate'), problems),
	configFile: configFileTypes(readPackage(LIB_ROOT, 'internal/declare'), problems),
	examples: examples(join(LIB_ROOT, 'examples'), firstTable(section('quick-start')), problems),
};

writeJson(OUT, model);

const routes = model.api.reduce((count, group) => count + group.routes.length, 0);

console.log(
	`docs-model: ${pages.length} pages, ${model.env.length} variables, ${routes} API routes, ${model.cli.length} commands, ` +
		`${model.configFile.length} config types, ${model.examples.length} examples (v${model.version}) → ${OUT}`,
);
problems.forEach((problem) => console.warn(`docs-model: ${problem}`));

if (strict && problems.length) {
	console.error(`docs-model: ${problems.length} problem(s); fix them or run without --strict`);
	process.exit(1);
}
