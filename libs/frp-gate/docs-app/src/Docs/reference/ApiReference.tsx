import type { ReactNode } from 'react';
import { Inline } from '@osw/docs';
import { Code } from '@osw/react';
import { routeId } from '../../model/ids';
import type { ApiRoute } from '../../model/types';
import { model } from '../model';
import { Pill } from './Pill';

const STATUS_TEXT: Record<number, string> = { 200: '200 OK', 201: '201 Created', 204: '204 No Content' };
const fields = (names: string[]) => `{${names.map((name) => `"${name}"`).join(', ')}}`;

function Detail({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
			<dt className="w-16 shrink-0 text-xs font-semibold tracking-wide text-neutral-550 uppercase">{label}</dt>
			<dd className="min-w-0">{children}</dd>
		</div>
	);
}

function RouteCard({ route }: { route: ApiRoute }) {
	const result = route.result?.length === 1 && route.result[0] === 'ok' ? '{"ok": true}' : route.result ? fields(route.result) : 'the created object';

	return (
		<article id={routeId(route.method, route.path)} className="scroll-mt-20 rounded-xl border border-neutral-40 p-4">
			<h3 className="flex flex-wrap items-center gap-2 font-mono text-sm">
				<Pill tone={route.method === 'GET' ? 'secondary' : 'primary'} mono>{route.method}</Pill>
				<span className="break-all text-neutral-900">/api/v1/{route.path}</span>
			</h3>
			<p className="mt-2 text-sm leading-relaxed text-neutral-660"><Inline text={route.description} /></p>
			<dl className="mt-3 space-y-1.5 text-sm">
				{route.query.length > 0 && <Detail label="Query">{route.query.map((name) => <Code key={name} code={`?${name}=`} />)}</Detail>}
				{route.body.length > 0 && <Detail label="Body"><Code code={fields(route.body)} /></Detail>}
				<Detail label="Answer">
					<span className="text-neutral-550">{STATUS_TEXT[route.status] ?? route.status}</span>{' '}
					<Code code={result} />
				</Detail>
			</dl>
		</article>
	);
}

/** The JSON API, grouped by resource: routes from `internal/admin/api.go`, described by their handlers */
export function ApiReference() {
	return (
		<>
			{model.api.map((group) => (
				<section key={group.resource} aria-labelledby={`api-${group.resource}`} className="mt-10">
					<h2 id={`api-${group.resource}`} className="scroll-mt-20 text-lg font-semibold tracking-tight capitalize">{group.resource}</h2>
					<div className="mt-4 space-y-3">
						{group.routes.map((route) => <RouteCard key={`${route.method} ${route.path}`} route={route} />)}
					</div>
				</section>
			))}
		</>
	);
}
