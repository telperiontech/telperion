import type * as ts from 'typescript';
import type { DocsCategory, DocsEntry, DocsModel } from '../src/model/types';
import { rootCategory, type ApiModelConfig } from './config';
import { extractDeclarations, pickPrimary } from './extract-declarations';
import { extractExtension } from './extract-extension';
import { extractGlobals } from './extract-globals';
import { listModuleFiles, type ModuleFile } from './module-files';
import { getSourceFile } from './program';

function buildEntry(module: ModuleFile, program: ts.Program, config: ApiModelConfig): DocsEntry | undefined {
	const sourceFile = getSourceFile(program, config.workspaceRoot, module.sourcePath);
	const declarations = extractDeclarations(sourceFile, program.getTypeChecker());
	const primary = pickPrimary(declarations, module.baseName);

	if (!primary) return undefined;

	return {
		id: module.id,
		category: module.category,
		importPath: `${config.packageName}/${module.id}`,
		sourcePath: module.sourcePath,
		primary,
		related: declarations.filter((declaration) => declaration !== primary),
		extensions: [],
		globals: extractGlobals(sourceFile),
	};
}

/** Base entry a `proto/`/`static/` module wraps: the configured one, else by file name in the same category, then root, then any */
function findBaseEntry(module: ModuleFile, entries: DocsEntry[], config: ApiModelConfig): DocsEntry | undefined {
	const explicit = config.extensionBases?.[module.id];

	if (explicit) return entries.find((entry) => entry.id === explicit);

	const byName = entries.filter((entry) => entry.id.split('/').pop() === module.baseName);

	return (
		byName.find((entry) => entry.category === module.category) ??
		byName.find((entry) => entry.category === rootCategory(config)) ??
		byName[0]
	);
}

const titleCase = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

function buildCategories(entries: DocsEntry[], config: ApiModelConfig): DocsCategory[] {
	const meta = config.categories ?? {};
	const ids = [...new Set(entries.map((entry) => entry.category))];
	const known = Object.keys(meta);
	const order = (id: string) => (known.includes(id) ? known.indexOf(id) : known.length);

	return ids
		.sort((a, b) => order(a) - order(b) || a.localeCompare(b))
		.map((id) => ({
			id,
			title: meta[id]?.title ?? titleCase(id),
			description: meta[id]?.description ?? '',
			entryIds: entries.filter((entry) => entry.category === id).map((entry) => entry.id),
		}));
}

/** Docs model of every module of the library, plus warnings for undocumented or unmatched modules */
export function buildModel(program: ts.Program, version: string, config: ApiModelConfig): { model: DocsModel; warnings: string[] } {
	const modules = listModuleFiles(config);
	const warnings: string[] = [];
	const entries = modules
		.filter((module) => module.kind === 'base')
		.map((module) => buildEntry(module, program, config))
		.filter((entry): entry is DocsEntry => !!entry);

	for (const module of modules.filter((candidate) => candidate.kind !== 'base')) {
		const extension = extractExtension(module, getSourceFile(program, config.workspaceRoot, module.sourcePath), config.packageName);
		const base = findBaseEntry(module, entries, config);

		if (extension && base) base.extensions.push(extension);
		else warnings.push(`No ${extension ? 'base module' : 'global augmentation'} found for ${module.id}`);
	}

	for (const entry of entries) {
		if (!entry.primary.summary) warnings.push(`Missing doc comment: ${entry.sourcePath} (${entry.primary.name})`);
	}

	return {
		model: {
			packageName: config.packageName,
			version,
			generatedAt: new Date().toISOString(),
			categories: buildCategories(entries, config),
			entries,
		},
		warnings,
	};
}
