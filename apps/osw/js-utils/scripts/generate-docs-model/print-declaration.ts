import * as ts from 'typescript';

const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
const f = ts.factory;

const DROPPED_MODIFIERS = new Set([
	ts.SyntaxKind.ExportKeyword,
	ts.SyntaxKind.DefaultKeyword,
	ts.SyntaxKind.DeclareKeyword,
	ts.SyntaxKind.AsyncKeyword,
	ts.SyntaxKind.PublicKeyword,
	ts.SyntaxKind.OverrideKeyword,
]);

const HIDDEN_MEMBER_MODIFIERS = new Set([ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword]);

function keptModifiers(node: ts.HasModifiers): ts.Modifier[] | undefined {
	return ts.getModifiers(node)?.filter((modifier) => !DROPPED_MODIFIERS.has(modifier.kind));
}

function print(node: ts.Node, sourceFile: ts.SourceFile): string {
	return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
}

/** Overload signatures when present, otherwise the implementation signature */
function signatureDeclarations<T extends ts.SignatureDeclaration & { body?: ts.Node }>(declarations: T[]): T[] {
	const overloads = declarations.filter((declaration) => !declaration.body);
	return overloads.length ? overloads : declarations;
}

export function printFunctions(declarations: ts.FunctionDeclaration[]): string[] {
	return signatureDeclarations(declarations).map((node) =>
		print(
			f.updateFunctionDeclaration(node, keptModifiers(node), node.asteriskToken, node.name, node.typeParameters, node.parameters, node.type, undefined),
			node.getSourceFile(),
		),
	);
}

function isPublicMember(member: ts.ClassElement): boolean {
	if (ts.isClassStaticBlockDeclaration(member) || ts.isSemicolonClassElement(member)) return false;
	if (member.name && (ts.isPrivateIdentifier(member.name) || ts.isComputedPropertyName(member.name))) return false;
	return !(ts.canHaveModifiers(member) && ts.getModifiers(member)?.some((modifier) => HIDDEN_MEMBER_MODIFIERS.has(modifier.kind)));
}

function stripMember(member: ts.ClassElement, checker: ts.TypeChecker): ts.ClassElement {
	if (ts.isMethodDeclaration(member)) {
		return f.updateMethodDeclaration(member, keptModifiers(member), member.asteriskToken, member.name, member.questionToken, member.typeParameters, member.parameters, member.type, undefined);
	}
	if (ts.isConstructorDeclaration(member)) {
		return f.updateConstructorDeclaration(member, keptModifiers(member), member.parameters, undefined);
	}
	if (ts.isGetAccessorDeclaration(member)) {
		const type = member.type ?? f.createTypeReferenceNode(checker.typeToString(checker.getTypeAtLocation(member.name)));
		return f.updateGetAccessorDeclaration(member, keptModifiers(member), member.name, member.parameters, type, undefined);
	}
	if (ts.isSetAccessorDeclaration(member)) {
		return f.updateSetAccessorDeclaration(member, keptModifiers(member), member.name, member.parameters, undefined);
	}
	if (ts.isPropertyDeclaration(member)) {
		const type = member.type ?? f.createTypeReferenceNode(checker.typeToString(checker.getTypeAtLocation(member.name)));
		return f.updatePropertyDeclaration(member, keptModifiers(member), member.name, member.questionToken, type, undefined);
	}
	return member;
}

/** Drops implementation members that have overload signatures next to them */
function withoutImplementations(members: ts.ClassElement[]): ts.ClassElement[] {
	const key = (member: ts.ClassElement) => (ts.isConstructorDeclaration(member) ? 'constructor' : member.name?.getText());
	const overloaded = new Set(
		members.filter((member) => (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) && !member.body).map(key),
	);
	return members.filter((member) => !((ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) && member.body && overloaded.has(key(member))));
}

/** Class shape with public members only and no bodies */
export function printClass(node: ts.ClassDeclaration, checker: ts.TypeChecker): string {
	const members = withoutImplementations(node.members.filter(isPublicMember)).map((member) => stripMember(member, checker));
	return print(f.updateClassDeclaration(node, keptModifiers(node), node.name, node.typeParameters, node.heritageClauses, members), node.getSourceFile());
}

export function printVariable(node: ts.VariableDeclaration, checker: ts.TypeChecker): string {
	const type = checker.typeToString(checker.getTypeAtLocation(node.name), undefined, ts.TypeFormatFlags.NoTruncation);
	return `const ${node.name.getText()}: ${type};`;
}

export function printTypeLike(node: ts.TypeAliasDeclaration | ts.InterfaceDeclaration | ts.EnumDeclaration): string {
	if (ts.isTypeAliasDeclaration(node)) {
		return print(f.updateTypeAliasDeclaration(node, keptModifiers(node), node.name, node.typeParameters, node.type), node.getSourceFile());
	}
	if (ts.isInterfaceDeclaration(node)) {
		return print(f.updateInterfaceDeclaration(node, keptModifiers(node), node.name, node.typeParameters, node.heritageClauses, node.members), node.getSourceFile());
	}
	return print(f.updateEnumDeclaration(node, keptModifiers(node), node.name, node.members), node.getSourceFile());
}

/** `interface Array<T> { ... }` from a `declare global` augmentation */
export function printAugmentation(node: ts.InterfaceDeclaration): string {
	return printTypeLike(node);
}
