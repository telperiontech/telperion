import type { ConfigField, ConfigType } from '../../src/model/types';
import { docMarkdown, structBody, typeDoc, type GoPackage } from './go-source';

/** Go field type → how it is written in YAML */
function yamlType(goType: string): string {
	const list = /^\[\](\w+)$/.exec(goType);
	const map = /^map\[string\](\w+)$/.exec(goType);

	if (list) return list[1] === 'string' ? 'list of strings' : `list of ${list[1]}`;

	if (map) return `map of name → ${map[1]}`;

	if (goType === '*bool' || goType === 'bool') return 'boolean';

	if (goType === 'Ports') return 'port or range';

	return goType;
}

const FIELD = /^\s*(\w+)\s+(\S+)\s+`yaml:"([^",]+)(,omitempty)?"`(?:\s*\/\/\s*(.*))?$/;

function readStruct(declare: GoPackage, name: string, path: string): ConfigType | undefined {
	const body = structBody(declare, name);

	if (!body) return undefined;

	const keys = new Map<string, string>();
	const fields: ConfigField[] = body.split('\n').flatMap((line) => {
		const match = FIELD.exec(line);

		if (!match) return [];

		const [, goName, goType, key, omitempty, comment = ''] = match;

		keys.set(goName, key);

		return [{ key, type: yamlType(goType), required: !omitempty, description: comment }];
	});
	// Doc comments name Go fields (`KeyEnv`); the page shows YAML keys (`key_env`)
	const goNames = [...keys.keys()].sort((a, b) => b.length - a.length);
	const description = docMarkdown(typeDoc(declare, name) ?? [], { name, codeLanguage: 'yaml' }).replace(
		new RegExp(`(?<![\\w\`])(${goNames.join('|')})(?![\\w\`])`, 'g'),
		(goName) => `\`${keys.get(goName)}\``,
	);

	return { name, path, description, fields };
}

/**
 * The config file reference: `File` in `internal/declare/file.go` and every struct it uses,
 * top-down. Fields are YAML keys with their types; descriptions are the types' doc comments.
 */
export function configFileTypes(declare: GoPackage, problems: string[]): ConfigType[] {
	const types: ConfigType[] = [];
	const pending = [{ name: 'File', path: '' }];
	const seen = new Set<string>();

	while (pending.length) {
		const { name, path } = pending.shift() as { name: string; path: string };

		if (seen.has(name)) continue;
		seen.add(name);

		const type = readStruct(declare, name, path);

		if (!type) {
			problems.push(`internal/declare: struct ${name} not found`);

			continue;
		}

		types.push(type);

		for (const field of type.fields) {
			const nested = /(?:of|→) (\w+Spec)$/.exec(field.type)?.[1];
			const key = path ? `${path}.${field.key}` : field.key;

			// `instances: map` → `instances.<name>`, `grants: list` → `grants[]`
			if (nested) pending.push({ name: nested, path: field.type.startsWith('map') ? `${key}.<name>` : `${key}[]` });
		}
	}

	return types;
}
