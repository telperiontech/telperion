import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ElementsModel, EntryDoc } from '../../src/Docs/model/types';
import { ENTRY_META, LIB_ROOT, PACKAGE_NAME, PROJECT_JSON_PATH, WORKSPACE_ROOT } from './config';
import { customElementsOf, type CemPackage } from './manifest';
import { readGuide } from './readme';
import { firstParagraph, titleFromId } from './text';
import { toElementDoc } from './to-element-doc';

/** Entry folders from the library's build target: `router/index` → `router` (the root `index` is skipped) */
function entryIds(): string[] {
	const project = JSON.parse(readFileSync(join(WORKSPACE_ROOT, PROJECT_JSON_PATH), 'utf8'));
	const entries = Object.keys(project.targets?.build?.options?.entry ?? {});

	return entries.filter((key) => key !== 'index').map((key) => key.replace(/\/index$/, ''));
}

const order = (id: string) => {
	const index = Object.keys(ENTRY_META).indexOf(id);

	return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

export interface BuildResult {
	model: ElementsModel;
	warnings: string[];
}

export function buildModel(manifest: CemPackage, version: string): BuildResult {
	const warnings: string[] = [];
	const elements = customElementsOf(manifest);
	const ids = entryIds().sort((a, b) => order(a) - order(b) || a.localeCompare(b));

	const entries: EntryDoc[] = ids.map((id) => {
		const folder = `${LIB_ROOT}/src/${id}`;
		const guide = readGuide(folder);
		const entryElements = elements
			.filter(({ module }) => module.path.startsWith(`src/${id}/`))
			.map(({ module, declaration }) => toElementDoc(module, declaration))
			.sort((a, b) => a.tagName.localeCompare(b.tagName));
		const meta = ENTRY_META[id];

		if (!meta) warnings.push(`Entry "${id}" has no ENTRY_META; using a generated title`);

		if (!entryElements.length) warnings.push(`Entry "${id}" declares no custom elements`);

		for (const element of entryElements) {
			if (!element.description) warnings.push(`<${element.tagName}> has no class doc comment`);
		}

		return {
			id,
			title: meta?.title ?? titleFromId(id),
			summary: meta?.summary ?? (guide ? firstParagraph(guide) : entryElements[0]?.summary ?? ''),
			importPath: `${PACKAGE_NAME}/${id}`,
			sourcePath: folder,
			guide,
			elements: entryElements,
		};
	});

	const covered = new Set(entries.flatMap((entry) => entry.elements.map((element) => element.tagName)));

	for (const { declaration } of elements) {
		if (!covered.has(declaration.tagName ?? '')) warnings.push(`<${declaration.tagName}> is not under any entry point`);
	}

	return {
		model: {
			packageName: PACKAGE_NAME,
			version,
			generatedAt: new Date().toISOString(),
			cdnUrl: `https://cdn.jsdelivr.net/npm/${PACKAGE_NAME}@${version}/iife/elements.js`,
			entries,
		},
		warnings,
	};
}
