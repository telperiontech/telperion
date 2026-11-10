import type { Args } from './types';

/** Parses a query value back into the type of the story's own value for that arg */
function parseValue(raw: string, reference: unknown): unknown {
	if (typeof reference === 'number') {
		const value = Number(raw);

		return Number.isFinite(value) ? value : reference;
	}

	if (typeof reference === 'boolean') return raw === 'true';

	return raw;
}

/** Story args overridden by the query string, e.g. `?density=120&color=%23ff6b9d` */
export function argsFromSearch(search: string, defaults: Args): Args {
	const params = new URLSearchParams(search);
	const args = { ...defaults };

	for (const [name, raw] of params) {
		args[name] = parseValue(raw, defaults[name]);
	}

	return args;
}

/** Query string holding only the args that differ from the story's defaults */
export function searchFromArgs(args: Args, defaults: Args): string {
	const params = new URLSearchParams();

	for (const [name, value] of Object.entries(args)) {
		if (value !== defaults[name] && value !== undefined) params.set(name, String(value));
	}

	const query = params.toString();

	return query ? `?${query}` : '';
}

/** Names of args whose value differs from the story's defaults */
export function changedArgs(args: Args, defaults: Args): string[] {
	return Object.keys(args).filter((name) => args[name] !== defaults[name]);
}
