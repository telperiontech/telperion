import * as ts from 'typescript';
import type { DocsExtension } from '../../src/Docs/model/types';
import { PACKAGE_NAME } from './config';
import type { ModuleFile } from './module-files';
import { leadingJsDoc, parseJsDoc } from './parse-jsdoc';
import { printAugmentation } from './print-declaration';

function globalInterfaces(sourceFile: ts.SourceFile): ts.InterfaceDeclaration[] {
	return sourceFile.statements
		.filter((statement): statement is ts.ModuleDeclaration => ts.isModuleDeclaration(statement) && statement.name.getText() === 'global')
		.flatMap((declaration) => (declaration.body && ts.isModuleBlock(declaration.body) ? [...declaration.body.statements] : []))
		.filter(ts.isInterfaceDeclaration);
}

/** `ArrayConstructor` → `Array`; instance interfaces keep their name */
const targetName = (interfaceName: string) => interfaceName.replace(/Constructor$/, '');

/** Reads a `proto/` or `static/` module's `declare global` augmentation */
export function extractExtension(module: ModuleFile, sourceFile: ts.SourceFile): DocsExtension | undefined {
	const interfaces = globalInterfaces(sourceFile);
	if (!interfaces.length) return undefined;

	const members = interfaces.flatMap((declaration) => declaration.members);
	const raw = members.map(leadingJsDoc).find(Boolean);

	return {
		kind: module.kind === 'prototype' ? 'prototype' : 'static',
		target: targetName(interfaces[0].name.text),
		members: [...new Set(members.map((member) => member.name?.getText() ?? '').filter(Boolean))],
		importPath: `${PACKAGE_NAME}/${module.id}`,
		sourcePath: module.sourcePath,
		signature: interfaces.map(printAugmentation).join('\n'),
		description: parseJsDoc(raw).description,
	};
}
