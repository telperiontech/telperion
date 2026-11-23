import type { ApiGroup, ApiRoute } from '../../src/model/types';
import { bracedAt, docMarkdown, funcBody, funcDoc, structBody, type GoPackage } from './go-source';

const STATUS: Record<string, number> = { OK: 200, Created: 201, NoContent: 204 };
const jsonTags = (struct: string) => [...struct.matchAll(/json:"(\w+)/g)].map(([, tag]) => tag);

/** Fields of the handler's request body: `var in struct { … }` or `var in SomeInput` */
function bodyFields(admin: GoPackage, body: string): string[] {
	const inline = /var in struct \{([\s\S]*?)\n\t\}/.exec(body);

	if (inline) return jsonTags(inline[1]);

	const named = /var in (\w+)/.exec(body)?.[1];

	return named ? jsonTags(structBody(admin, named) ?? '') : [];
}

/** The handler's body plus the bodies of the `s.helper(r)` methods it calls with the request */
function withHelpers(admin: GoPackage, body: string): string {
	const helpers = [...body.matchAll(/\bs\.(\w+)\(r\)/g)].map(([, name]) => funcBody(admin, name) ?? '');

	return [body, ...helpers].join('\n');
}

/**
 * The success answers of a handler, from its `s.apiResult(w, http.StatusX, value, err)` calls:
 * a `map[string]any{…}` lists its keys, `nil` answers `{"ok": true}`, anything else is one object.
 */
function successResult(body: string): Pick<ApiRoute, 'status' | 'result'> {
	const answers = [...body.matchAll(/s\.apiResult\(w, http\.Status(\w+), /g)].map((call) => {
		const status = STATUS[call[1]] ?? 200;
		const valueStart = call.index + call[0].length;
		const value = body.slice(valueStart);

		if (value.startsWith('nil')) return { status, result: ['ok'], rank: 0 };

		if (value.startsWith('map[string]any{')) {
			const result = [...(bracedAt(body, valueStart) ?? '').matchAll(/"(\w+)":/g)].map(([, key]) => key);

			return { status, result, rank: 1 + result.length };
		}

		return { status, result: undefined, rank: 1 };
	});
	// The richest answer wins: e.g. `rotate` returns the new token where disable/enable answer ok
	const [best = { status: 200, result: ['ok'] }] = answers.sort((a, b) => b.rank - a.rank);

	return { status: best.status, result: best.result };
}

/**
 * The JSON API reference, from `apiRoutes` in `internal/admin/api.go`: one entry per
 * `m.HandleFunc("METHOD "+p+"path", s.handler)`, described by the handler's doc comment.
 */
export function apiGroups(admin: GoPackage, problems: string[]): ApiGroup[] {
	const routesBody = funcBody(admin, 'apiRoutes') ?? '';
	const groups = new Map<string, ApiRoute[]>();

	if (!routesBody) problems.push('internal/admin: apiRoutes not found');

	for (const [, method, path, handler] of routesBody.matchAll(/m\.HandleFunc\("(GET|POST|PUT|DELETE) "\+p\+"([^"]*)", s\.(\w+)/g)) {
		const doc = funcDoc(admin, handler);
		const body = withHelpers(admin, funcBody(admin, handler) ?? '');

		if (!doc?.length) problems.push(`internal/admin: ${handler} (${method} ${path}) has no doc comment`);

		const route: ApiRoute = {
			method: method as ApiRoute['method'],
			path,
			description: docMarkdown(doc ?? [], { name: handler }),
			body: method === 'GET' || method === 'DELETE' ? [] : bodyFields(admin, body),
			query: [...body.matchAll(/URL\.Query\(\)\.Get\("(\w+)"\)/g)].map(([, name]) => name),
			...successResult(body),
		};
		const resource = path.split('/')[0];

		groups.set(resource, [...(groups.get(resource) ?? []), route]);
	}

	return [...groups].map(([resource, routes]) => ({ resource, routes }));
}
