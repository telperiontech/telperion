import * as ts from 'typescript';
import type { DocsMember, MemberKind } from '../src/model/types';
import { leadingJsDoc, parseJsDoc } from './parse-jsdoc';
import { isPublicMember, printMember, withoutImplementations } from './print-declaration';

const isStatic = (member: ts.ClassElement) =>
	!!(ts.canHaveModifiers(member) && ts.getModifiers(member)?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword));

function memberKind(member: ts.ClassElement): MemberKind {
	if (ts.isConstructorDeclaration(member)) return 'constructor';

	if (ts.isMethodDeclaration(member)) return 'method';

	if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) return 'accessor';

	return 'property';
}

const memberName = (member: ts.ClassElement) => (ts.isConstructorDeclaration(member) ? 'constructor' : member.name!.getText());

/**
 * One member from all its declarations (overloads, or a get/set pair), or nothing when none of
 * them carries a doc comment: undocumented members are already in the class signature.
 */
function toMember(declarations: ts.ClassElement[], checker: ts.TypeChecker, inheritedFrom?: string): DocsMember | undefined {
	const raw = declarations.map(leadingJsDoc).find(Boolean);

	if (!raw) return undefined;

	const { title: _title, see: _see, ...doc } = parseJsDoc(raw);
	const [first] = declarations;

	return {
		name: memberName(first),
		kind: memberKind(first),
		static: isStatic(first),
		...(inheritedFrom ? { inheritedFrom } : {}),
		signatures: withoutImplementations(declarations).map((declaration) => printMember(declaration, checker)),
		...doc,
	};
}

/** Public class elements of a symbol, e.g. a method's overloads; parameter properties are left to the constructor */
const classElements = (symbol: ts.Symbol): ts.ClassElement[] =>
	(symbol.declarations ?? []).filter((declaration): declaration is ts.ClassElement => ts.isClassElement(declaration) && isPublicMember(declaration));

/** Groups a class's own public members by name, in source order */
function ownGroups(node: ts.ClassDeclaration): ts.ClassElement[][] {
	const groups = new Map<string, ts.ClassElement[]>();

	for (const member of node.members.filter(isPublicMember)) {
		const key = `${isStatic(member) ? 'static ' : ''}${memberName(member)}`;

		groups.set(key, [...(groups.get(key) ?? []), member]);
	}

	return [...groups.values()];
}

/** Instance members a class inherits and does not redeclare, grouped by declaring class in source order */
function inheritedGroups(node: ts.ClassDeclaration, checker: ts.TypeChecker): { owner: string; declarations: ts.ClassElement[] }[] {
	const symbol = node.name && checker.getSymbolAtLocation(node.name);

	if (!symbol) return [];

	return checker
		.getPropertiesOfType(checker.getDeclaredTypeOfSymbol(symbol))
		.map((property) => classElements(property))
		.filter((declarations) => declarations.length && declarations[0].parent !== node && !isStatic(declarations[0]))
		.map((declarations) => ({ owner: (declarations[0].parent as ts.ClassDeclaration).name?.text ?? '', declarations }))
		.sort((a, b) => a.declarations[0].getSourceFile().fileName.localeCompare(b.declarations[0].getSourceFile().fileName) || a.declarations[0].pos - b.declarations[0].pos);
}

/** Documented public members of a class: its own (constructor and statics included), then inherited instance members */
export function extractMembers(node: ts.ClassDeclaration, checker: ts.TypeChecker): DocsMember[] {
	const own = ownGroups(node).map((declarations) => toMember(declarations, checker));
	const inherited = inheritedGroups(node, checker).map(({ owner, declarations }) => toMember(declarations, checker, owner));

	return [...own, ...inherited].filter((member): member is DocsMember => !!member);
}
