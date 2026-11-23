import type { EnvVar } from '../../src/model/types';
import type { GoPackage } from './go-source';

interface GoVar {
	name: string;
	default?: string;
	fileVariant: boolean;
	required: boolean;
}

/** README defaults that mean "no default" */
const NO_DEFAULT = new Set(['(none)', '(empty)', '(required)', '']);

/**
 * Every `FRP_GATE_*` variable `internal/config` reads, with its default as the code has it:
 * `env("NAME", "default")`, `secret(getenv, "NAME")` (also reads `NAME_FILE`), or a helper
 * that reads `getenv("NAME")` and otherwise returns a literal.
 */
function readGoVars(config: GoPackage): GoVar[] {
	const vars = new Map<string, GoVar>();
	const add = (name: string, fields: Partial<GoVar>) => {
		const current = vars.get(name) ?? { name, fileVariant: false, required: false };

		vars.set(name, { ...current, ...fields });
	};

	for (const [, name, value] of config.source.matchAll(/\benv\("(FRP_GATE_\w+)",\s*"([^"]*)"\)/g)) {
		add(name, { default: value || undefined });
	}

	for (const [, name] of config.source.matchAll(/\bsecret\(getenv,\s*"(FRP_GATE_\w+)"\)/g)) {
		add(name, { fileVariant: true });
	}

	// Helpers such as DBPath: `if v := getenv("FRP_GATE_DB"); v != "" { return v }; return "/data/frp-gate.db"`
	for (const [, body] of config.source.matchAll(/^func \w+\(getenv func\(string\) string\) string \{([\s\S]*?)^\}/gm)) {
		const name = body.match(/getenv\("(FRP_GATE_\w+)"\)/)?.[1];
		const fallback = [...body.matchAll(/return "([^"]*)"/g)].pop()?.[1];

		if (name) add(name, { default: fallback || undefined });
	}

	for (const name of vars.keys()) {
		if (new RegExp(`"${name}[^"]*must be set`).test(config.source)) add(name, { required: true });
	}

	return [...vars.values()];
}

const unquote = (cell: string) => cell.replace(/^`|`$/g, '');

/**
 * The environment reference: variables and defaults from Go, descriptions from the README's
 * Configuration table (`| Variable | Default | Meaning |`), in the README's order. Any
 * disagreement between the two is reported.
 */
export function envVars(config: GoPackage, readmeRows: string[][], problems: string[]): EnvVar[] {
	const goVars = new Map(readGoVars(config).map((v) => [v.name, v]));
	const result: EnvVar[] = [];

	for (const [nameCell = '', defaultCell = '', description = ''] of readmeRows) {
		const name = unquote(nameCell);
		const goVar = goVars.get(name);

		if (!goVar) {
			problems.push(`README documents ${name}, which internal/config does not read`);

			continue;
		}

		const readmeDefault = NO_DEFAULT.has(defaultCell) ? undefined : unquote(defaultCell);

		if (readmeDefault !== goVar.default) {
			problems.push(`${name}: README default ${readmeDefault ?? '(none)'} differs from the code's ${goVar.default ?? '(none)'}`);
		}

		result.push({ ...goVar, description });
		goVars.delete(name);
	}

	for (const goVar of goVars.values()) {
		problems.push(`${goVar.name} is read by internal/config but missing from the README's Configuration table`);
		result.push({ ...goVar, description: '' });
	}

	return result;
}
