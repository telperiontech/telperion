import * as ts from 'typescript';
import type { DocsGlobal } from '../src/model/types';
import { leadingJsDoc, parseJsDoc } from './parse-jsdoc';

const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });

function globalStatements(sourceFile: ts.SourceFile): ts.Statement[] {
	return sourceFile.statements
		.filter((statement): statement is ts.ModuleDeclaration => ts.isModuleDeclaration(statement) && statement.name.getText() === 'global')
		.flatMap((declaration) => (declaration.body && ts.isModuleBlock(declaration.body) ? [...declaration.body.statements] : []));
}

function toGlobals(statement: ts.Statement, sourceFile: ts.SourceFile): DocsGlobal[] {
	const description = parseJsDoc(leadingJsDoc(statement)).description;
	const signature = printer.printNode(ts.EmitHint.Unspecified, statement, sourceFile);

	if (ts.isVariableStatement(statement)) {
		return statement.declarationList.declarations.map((declaration) => ({ name: declaration.name.getText(), signature, description }));
	}

	if (ts.isFunctionDeclaration(statement) && statement.name) {
		return [{ name: statement.name.text, signature, description }];
	}

	return [];
}

/**
 * Values a base module declares in `declare global` (`var URLPattern: …`). Interface
 * augmentations are left to `extract-extension`, which reads `proto/` and `static/` modules.
 */
export function extractGlobals(sourceFile: ts.SourceFile): DocsGlobal[] {
	return globalStatements(sourceFile).flatMap((statement) => toGlobals(statement, sourceFile));
}
