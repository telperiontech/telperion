import { readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { ROOT_CATEGORY, SOURCE_ROOT, WORKSPACE_ROOT } from './config';

export type ModuleKind = 'base' | 'prototype' | 'static';

export interface ModuleFile {
	/** Module id relative to `src`, without extension: `array/proto/difference` */
	id: string;
	/** Workspace-relative source path */
	sourcePath: string;
	kind: ModuleKind;
	category: string;
	/** File name without extension: `difference` */
	baseName: string;
}

const IGNORED = /(\.spec|\.test|\.d)\.ts$/;

function walk(dir: string): string[] {
	return readdirSync(join(WORKSPACE_ROOT, dir), { withFileTypes: true }).flatMap((dirent) => {
		const path = posix.join(dir, dirent.name);
		if (dirent.isDirectory()) return walk(path);
		return dirent.name.endsWith('.ts') && !IGNORED.test(dirent.name) && dirent.name !== 'index.ts' ? [path] : [];
	});
}

function toModuleFile(sourcePath: string): ModuleFile {
	const id = posix.relative(SOURCE_ROOT, sourcePath).replace(/\.ts$/, '');
	const segments = id.split('/');
	const baseName = segments[segments.length - 1];
	const folder = segments.length > 1 ? segments[segments.length - 2] : '';
	const kind: ModuleKind = folder === 'proto' ? 'prototype' : folder === 'static' ? 'static' : 'base';

	return { id, sourcePath, kind, baseName, category: segments.length > 1 ? segments[0] : ROOT_CATEGORY };
}

/** Every importable, non-barrel module of the library, sorted by id */
export function listModuleFiles(): ModuleFile[] {
	return walk(SOURCE_ROOT).map(toModuleFile).sort((a, b) => a.id.localeCompare(b.id));
}
