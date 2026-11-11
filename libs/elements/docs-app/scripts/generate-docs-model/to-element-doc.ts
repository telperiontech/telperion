import type { ApiMethod, ApiNamed, ApiProperty, ElementDoc } from '../../src/Docs/model/types';
import { HIDDEN_MEMBERS, LIB_ROOT } from './config';
import type { CemDeclaration, CemMember, CemModule, CemNamed } from './manifest';
import { cleanText, firstParagraph } from './text';

const optional = (text: string | undefined) => (text ? text : undefined);

/** Private (`#x`, `_x`, `privacy`), symbol-keyed (`[KEY]`) and static members are not public instance API */
function isPublic(member: CemMember): boolean {
	if (member.static || member.privacy === 'private' || member.privacy === 'protected') return false;

	return !/^[#_[]/.test(member.name) && !HIDDEN_MEMBERS.has(member.name);
}

function toNamed(item: CemNamed): ApiNamed {
	return { name: item.name, description: optional(cleanText(item.description ?? item.summary)), default: optional(item.default) };
}

function toProperty(member: CemMember): ApiProperty {
	return {
		name: member.name,
		type: optional(member.type?.text),
		default: optional(member.default),
		description: optional(cleanText(member.description ?? member.summary)),
		readonly: member.readonly || undefined,
		attribute: member.attribute,
	};
}

function toMethod(member: CemMember): ApiMethod {
	const parameters = (member.parameters ?? [])
		.map((parameter) => `${parameter.rest ? '...' : ''}${parameter.name}${parameter.optional ? '?' : ''}${parameter.type ? `: ${parameter.type.text}` : ''}`)
		.join(', ');
	const returns = member.return?.type?.text;

	return {
		name: member.name,
		signature: `${member.name}(${parameters})${returns ? `: ${returns}` : ''}`,
		description: optional(cleanText(member.description ?? member.summary)),
	};
}

/** The docs view of one manifest declaration */
export function toElementDoc(module: CemModule, declaration: CemDeclaration): ElementDoc {
	const description = cleanText(declaration.description ?? declaration.summary);
	const members = (declaration.members ?? []).filter(isPublic);

	return {
		tagName: declaration.tagName ?? '',
		className: declaration.name,
		summary: firstParagraph(description),
		description,
		sourcePath: `${LIB_ROOT}/${module.path}`,
		attributes: (declaration.attributes ?? []).map((attribute) => ({
			name: attribute.name,
			type: optional(attribute.type?.text),
			default: optional(attribute.default),
			description: optional(cleanText(attribute.description ?? attribute.summary)),
			fieldName: attribute.fieldName,
		})),
		properties: members.filter((member) => member.kind === 'field').map(toProperty),
		methods: members.filter((member) => member.kind === 'method').map(toMethod),
		// Unnamed events (only a type) cannot be listened to by name; the type alone is still documented.
		// camelCase names are variables the analyzer read from `dispatchEvent(new X(eventName))`, not event types.
		events: (declaration.events ?? []).filter((event) => !/[a-z][A-Z]/.test(event.name ?? '')).map((event) => ({
			name: event.name ?? '',
			type: optional(event.type?.text),
			description: optional(cleanText(event.description ?? event.summary)),
		})),
		slots: (declaration.slots ?? []).map(toNamed),
		cssProperties: (declaration.cssProperties ?? []).map(toNamed),
		cssParts: (declaration.cssParts ?? []).map(toNamed),
		cssStates: (declaration.cssStates ?? []).map(toNamed),
	};
}
