import type { CliCommand, CliFlag } from '../../src/model/types';
import { docMarkdown, funcBody, funcDoc, type GoPackage } from './go-source';

interface UsageLine {
	synopsis: string;
	summary: string;
}

/**
 * The command lines of `const usage` in main.go. The summaries start in one column, which
 * is found from the lines with a wide gap (a synopsis can be followed by a single space).
 */
function usageLines(main: GoPackage, problems: string[]): UsageLine[] {
	const usage = /const usage = `([\s\S]*?)`/.exec(main.source)?.[1];

	if (!usage) {
		problems.push('cmd/frp-gate: const usage not found');

		return [];
	}

	const lines = usage.split('\n').filter((line) => /^ {2}\S/.test(line));
	const columns = lines.map((line) => /^ {2}\S.*?\s{2,}(?=\S)/.exec(line)?.[0].length).filter((column): column is number => !!column);
	const column = Math.max(...columns);

	return lines.map((line) => ({ synopsis: line.slice(0, column).trim(), summary: line.slice(column).trim() }));
}

/** `case "apply":` → `applyCmd` from main's switch; the server itself is `serve` */
function commandFunctions(main: GoPackage): Map<string, string> {
	const functions = new Map<string, string>([['', 'serve']]);

	for (const [, names, fn] of main.source.matchAll(/case ((?:"[^"]+",?\s*)+):\s*\n\s*os\.Exit\((\w+)\(/g)) {
		for (const [, name] of names.matchAll(/"([^"]+)"/g)) functions.set(name, fn);
	}

	return functions;
}

/** `fs.String("f", os.Getenv("X"), "usage")` and `fs.Bool("dry-run", false, "usage")` */
function flagsOf(body: string): CliFlag[] {
	return [...body.matchAll(/fs\.(String|Bool)\("([\w-]+)",\s*(.+?),\s*"([^"]*)"\)/g)].map(([, type, name, value, description]) => ({
		name,
		type: type.toLowerCase() as CliFlag['type'],
		default: value.replace(/^os\.Getenv\("(\w+)"\)$/, '$$$1').replace(/^"(.*)"$/, '$1'),
		description,
	}));
}

/**
 * A command function's doc comment as details. A first line that repeats the synopsis
 * (`applyCmd: frp-gate apply [-f FILE]`) is dropped, as the page already shows it.
 */
function detailsOf(main: GoPackage, fn: string): string {
	const doc = funcDoc(main, fn) ?? [];
	const lines = doc[0]?.startsWith(`${fn}:`) ? doc.slice(1) : doc;

	return docMarkdown(lines, { name: fn }).trim();
}

/** The CLI reference: commands and summaries from the usage text, flags and details from each command's function */
export function cliCommands(main: GoPackage, problems: string[]): CliCommand[] {
	const functions = commandFunctions(main);

	return usageLines(main, problems).map(({ synopsis, summary }) => {
		const name = synopsis.startsWith('(') ? '' : synopsis.split(' ')[0];
		const fn = functions.get(name);

		if (name && !fn && name !== 'version') problems.push(`cmd/frp-gate: no function found for the "${name}" command`);

		return {
			name,
			synopsis: name ? synopsis : '',
			summary,
			details: fn ? detailsOf(main, fn) : '',
			flags: fn ? flagsOf(funcBody(main, fn) ?? '') : [],
		};
	});
}
