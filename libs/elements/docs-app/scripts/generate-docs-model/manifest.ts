import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MANIFEST_PATH, WORKSPACE_ROOT } from './config';

/**
 * The parts of the Custom Elements Manifest schema (v2) the generator reads.
 * See https://github.com/webcomponents/custom-elements-manifest/blob/main/schema.d.ts
 */
export interface CemType {
	text: string;
}

export interface CemNamed {
	name: string;
	description?: string;
	summary?: string;
	default?: string;
}

export interface CemAttribute extends CemNamed {
	type?: CemType;
	fieldName?: string;
}

export interface CemParameter extends CemNamed {
	type?: CemType;
	optional?: boolean;
	rest?: boolean;
}

export interface CemMember extends CemNamed {
	kind: 'field' | 'method';
	type?: CemType;
	static?: boolean;
	readonly?: boolean;
	privacy?: 'public' | 'private' | 'protected';
	attribute?: string;
	parameters?: CemParameter[];
	return?: { type?: CemType };
}

export interface CemEvent extends CemNamed {
	type?: CemType;
}

export interface CemDeclaration extends CemNamed {
	kind: string;
	tagName?: string;
	customElement?: boolean;
	attributes?: CemAttribute[];
	members?: CemMember[];
	events?: CemEvent[];
	slots?: CemNamed[];
	cssProperties?: CemNamed[];
	cssParts?: CemNamed[];
	cssStates?: CemNamed[];
}

export interface CemModule {
	path: string;
	declarations?: CemDeclaration[];
}

export interface CemPackage {
	schemaVersion: string;
	modules: CemModule[];
}

export function readManifest(): CemPackage {
	const path = join(WORKSPACE_ROOT, MANIFEST_PATH);

	try {
		return JSON.parse(readFileSync(path, 'utf8')) as CemPackage;
	} catch (error) {
		throw new Error(`Could not read ${MANIFEST_PATH}; run \`nx run elements:analyze\` first.\n${error}`);
	}
}

/** Custom element declarations with the module they are declared in */
export function customElementsOf(manifest: CemPackage): { module: CemModule; declaration: CemDeclaration }[] {
	return manifest.modules.flatMap((module) =>
		(module.declarations ?? [])
			.filter((declaration) => declaration.customElement && declaration.tagName)
			.map((declaration) => ({ module, declaration })),
	);
}
