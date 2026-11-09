import * as ts from 'typescript';
import type { DeclarationKind, DocsDeclaration } from '../../src/Docs/model/types';
import { leadingJsDoc, parseJsDoc } from './parse-jsdoc';
import { printClass, printFunctions, printTypeLike, printVariable } from './print-declaration';

interface RawDeclaration {
	name: string;
	kind: DeclarationKind;
	/** Nodes whose leading comments may hold the doc, in source order */
	docNodes: ts.Node[];
	signatures: string[];
}

function isExported(node: ts.Statement): boolean {
	return !!(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function collect(sourceFile: ts.SourceFile, checker: ts.TypeChecker): RawDeclaration[] {
	const functions = new Map<string, ts.FunctionDeclaration[]>();
	const declarations: RawDeclaration[] = [];

	for (const statement of sourceFile.statements.filter(isExported)) {
		if (ts.isFunctionDeclaration(statement) && statement.name) {
			const name = statement.name.text;
			if (!functions.has(name)) {
				functions.set(name, []);
				declarations.push({ name, kind: 'function', docNodes: [], signatures: [] });
			}
			functions.get(name)!.push(statement);
		} else if (ts.isClassDeclaration(statement) && statement.name) {
			declarations.push({ name: statement.name.text, kind: 'class', docNodes: [statement], signatures: [printClass(statement, checker)] });
		} else if (ts.isVariableStatement(statement)) {
			for (const declaration of statement.declarationList.declarations) {
				declarations.push({ name: declaration.name.getText(), kind: 'variable', docNodes: [statement], signatures: [printVariable(declaration, checker)] });
			}
		} else if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isEnumDeclaration(statement)) {
			const kind = ts.isTypeAliasDeclaration(statement) ? 'type' : ts.isInterfaceDeclaration(statement) ? 'interface' : 'enum';
			declarations.push({ name: statement.name.text, kind, docNodes: [statement], signatures: [printTypeLike(statement)] });
		}
	}

	for (const declaration of declarations) {
		const nodes = functions.get(declaration.name);
		if (declaration.kind === 'function' && nodes) {
			declaration.docNodes = nodes;
			declaration.signatures = printFunctions(nodes);
		}
	}

	return declarations;
}

function toDocsDeclaration({ name, kind, docNodes, signatures }: RawDeclaration): DocsDeclaration {
	const raw = docNodes.map(leadingJsDoc).find(Boolean);
	const { title, ...doc } = parseJsDoc(raw);
	return { name, kind, title: title ?? name, signatures, ...doc };
}

/** Every exported declaration of a module, documented */
export function extractDeclarations(sourceFile: ts.SourceFile, checker: ts.TypeChecker): DocsDeclaration[] {
	return collect(sourceFile, checker).map(toDocsDeclaration);
}

const camelCase = (fileName: string) => fileName.replace(/-(\w)/g, (_, char: string) => char.toUpperCase());

/** The declaration a module is named after (`smart-map` → `SmartMap`), else its first function or class */
export function pickPrimary(declarations: DocsDeclaration[], baseName: string): DocsDeclaration | undefined {
	const expected = camelCase(baseName);
	return (
		declarations.find((declaration) => declaration.name === expected) ??
		declarations.find((declaration) => declaration.name.toLowerCase() === expected.toLowerCase()) ??
		declarations.find((declaration) => declaration.kind === 'function' || declaration.kind === 'class') ??
		declarations[0]
	);
}
