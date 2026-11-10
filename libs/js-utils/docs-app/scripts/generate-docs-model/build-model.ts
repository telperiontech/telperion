import type * as ts from 'typescript';
import type { DocsCategory, DocsEntry, DocsModel } from '../../src/Docs/model/types';
import { CATEGORY_META, PACKAGE_NAME, ROOT_CATEGORY } from './config';
import { extractDeclarations, pickPrimary } from './extract-declarations';
import { extractExtension } from './extract-extension';
import { listModuleFiles, type ModuleFile } from './module-files';
import { getSourceFile } from './program';

function buildEntry(module: ModuleFile, program: ts.Program): DocsEntry | undefined {
	const declarations = extractDeclarations(getSourceFile(program, module.sourcePath), program.getTypeChecker());
	const primary = pickPrimary(declarations, module.baseName);
	if (!primary) return undefined;

	return {
		id: module.id,
		category: module.category,
		importPath: `${PACKAGE_NAME}/${module.id}`,
		sourcePath: module.sourcePath,
		primary,
		related: declarations.filter((declaration) => declaration !== primary),
		extensions: [],
	};
}

/** Base entry a `proto/`/`static/` module wraps: same category first, then root, then any category */
function findBaseEntry(module: ModuleFile, entries: DocsEntry[]): DocsEntry | undefined {
	const byName = entries.filter((entry) => entry.id.split('/').pop() === module.baseName);
	return (
		byName.find((entry) => entry.category === module.category) ??
		byName.find((entry) => entry.category === ROOT_CATEGORY) ??
		byName[0]
	);
}

function titleCase(id: string): string {
	return id.charAt(0).toUpperCase() + id.slice(1);
}

function buildCategories(entries: DocsEntry[]): DocsCategory[] {
	const ids = [...new Set(entries.map((entry) => entry.category))];
	const known = Object.keys(CATEGORY_META);
	const order = (id: string) => (known.includes(id) ? known.indexOf(id) : known.length);

	return ids
		.sort((a, b) => order(a) - order(b) || a.localeCompare(b))
		.map((id) => ({
			id,
			title: CATEGORY_META[id]?.title ?? titleCase(id),
			description: CATEGORY_META[id]?.description ?? '',
			entryIds: entries.filter((entry) => entry.category === id).map((entry) => entry.id),
		}));
}

export function buildModel(program: ts.Program, version: string): { model: DocsModel; warnings: string[] } {
	const modules = listModuleFiles();
	const warnings: string[] = [];

	const entries = modules
		.filter((module) => module.kind === 'base')
		.map((module) => buildEntry(module, program))
		.filter((entry): entry is DocsEntry => !!entry);

	for (const module of modules.filter((candidate) => candidate.kind !== 'base')) {
		const extension = extractExtension(module, getSourceFile(program, module.sourcePath));
		const base = findBaseEntry(module, entries);

		if (extension && base) base.extensions.push(extension);
		else warnings.push(`No ${extension ? 'base module' : 'global augmentation'} found for ${module.id}`);
	}

	for (const entry of entries) {
		if (!entry.primary.summary) warnings.push(`Missing doc comment: ${entry.sourcePath} (${entry.primary.name})`);
	}

	return {
		model: { packageName: PACKAGE_NAME, version, generatedAt: new Date().toISOString(), categories: buildCategories(entries), entries },
		warnings,
	};
}
