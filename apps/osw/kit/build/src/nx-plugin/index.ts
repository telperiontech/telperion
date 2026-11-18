import { existsSync } from 'node:fs';
import { join, posix } from 'node:path';
import { createNodesFromFiles, readJsonFile, type CreateNodesV2, type ProjectConfiguration } from '@nx/devkit';
import { docsRemoteTargets } from './docs-remote-targets';

/** Generator script locations, first match wins */
const MODEL_SCRIPTS = ['scripts/generate-docs-model.ts', 'scripts/generate-docs-model/main.ts'];

/**
 * Infers the serve/build/generate-model targets of every osw docs remote: a project
 * tagged `type:docs-app`. Registered in nx.json; project.json targets are merged over these.
 */
export const createNodesV2: CreateNodesV2 = [
	'**/project.json',
	(files, options, context) =>
		createNodesFromFiles(
			(file, _options, { workspaceRoot }) => {
				const project = readJsonFile<ProjectConfiguration>(join(workspaceRoot, file));

				if (!project.name || !project.tags?.includes('type:docs-app')) return {};

				const root = posix.dirname(file.replace(/\\/g, '/'));
				const modelScript = MODEL_SCRIPTS.map((script) => `${root}/${script}`).find((script) => existsSync(join(workspaceRoot, script)));

				return { projects: { [root]: { targets: docsRemoteTargets({ name: project.name, root, modelScript }) } } };
			},
			files,
			options,
			context,
		),
];
