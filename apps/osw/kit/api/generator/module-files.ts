import { readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { rootCategory, sourceRoot, type ApiModelConfig } from './config';

export type ModuleKind = 'base' | 'prototype' | 'static';

export interface ModuleFile {
	/** Module id relative to `src`, without extension: `array/proto/difference` */
	id: string;
	/** Workspace-relative source path */
	sourcePath: string;
	/** `proto/` and `static/` modules patch a global with a base module's function */
	kind: ModuleKind;
	category: string;
	/** File name without extension: `difference` */
	baseName: string;
}

const IGNORED = /(\.spec|\.test|\.d)\.ts$/;

function walk(workspaceRoot: string, dir: string): string[] {
	return readdirSync(join(workspaceRoot, dir), { withFileTypes: true }).flatMap((dirent) => {
		const path = posix.join(dir, dirent.name);

		if (dirent.isDirectory()) return walk(workspaceRoot, path);

		return dirent.name.endsWith('.ts') && !IGNORED.test(dirent.name) && dirent.name !== 'index.ts' ? [path] : [];
	});
}

function toModuleFile(sourcePath: string, config: ApiModelConfig): ModuleFile {
	const id = posix.relative(sourceRoot(config), sourcePath).replace(/\.ts$/, '');
	const segments = id.split('/');
	const baseName = segments[segments.length - 1];
	const folder = segments.length > 1 ? segments[segments.length - 2] : '';
	const kind: ModuleKind = folder === 'proto' ? 'prototype' : folder === 'static' ? 'static' : 'base';

	return { id, sourcePath, kind, baseName, category: segments.length > 1 ? segments[0] : rootCategory(config) };
}

/** Every importable, non-barrel module of the library, sorted by id */
export function listModuleFiles(config: ApiModelConfig): ModuleFile[] {
	return walk(config.workspaceRoot, sourceRoot(config))
		.map((path) => toModuleFile(path, config))
		.sort((a, b) => a.id.localeCompare(b.id));
}
