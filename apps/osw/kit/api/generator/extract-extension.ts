import * as ts from 'typescript';
import type { DocsExtension } from '../src/model/types';
import type { ModuleFile } from './module-files';
import { leadingJsDoc, parseJsDoc } from './parse-jsdoc';
import { printAugmentation } from './print-declaration';

/** Interfaces of `declare global { … }`, or else of module augmentations such as `declare module 'rxjs' { … }` */
function augmentedInterfaces(sourceFile: ts.SourceFile): { global: boolean; interfaces: ts.InterfaceDeclaration[] } {
	const modules = sourceFile.statements.filter(ts.isModuleDeclaration);
	const globals = modules.filter((declaration) => declaration.name.getText() === 'global');
	const augmentations = globals.length ? globals : modules.filter((declaration) => ts.isStringLiteral(declaration.name));

	return {
		global: globals.length > 0,
		interfaces: augmentations
			.flatMap((declaration) => (declaration.body && ts.isModuleBlock(declaration.body) ? [...declaration.body.statements] : []))
			.filter(ts.isInterfaceDeclaration),
	};
}

/** `ArrayConstructor` → `Array`; instance interfaces keep their name */
const targetName = (interfaceName: string) => interfaceName.replace(/Constructor$/, '');

/**
 * Reads a `proto/` or `static/` module's augmentation. A global's kind follows its folder; a
 * module augmentation patches another package's class, so its kind follows the interface:
 * `FooConstructor` is static, any other interface is the instance (prototype).
 */
export function extractExtension(module: ModuleFile, sourceFile: ts.SourceFile, packageName: string): DocsExtension | undefined {
	const { global, interfaces } = augmentedInterfaces(sourceFile);

	if (!interfaces.length) return undefined;

	const members = interfaces.flatMap((declaration) => declaration.members);
	const raw = members.map(leadingJsDoc).find(Boolean);
	const isStatic = global ? module.kind === 'static' : interfaces[0].name.text.endsWith('Constructor');

	return {
		kind: isStatic ? 'static' : 'prototype',
		target: targetName(interfaces[0].name.text),
		members: [...new Set(members.map((member) => member.name?.getText() ?? '').filter(Boolean))],
		importPath: `${packageName}/${module.id}`,
		sourcePath: module.sourcePath,
		signature: interfaces.map(printAugmentation).join('\n'),
		description: parseJsDoc(raw).description,
	};
}
