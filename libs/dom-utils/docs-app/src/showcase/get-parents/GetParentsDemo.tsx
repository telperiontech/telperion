import { useMemo, useRef } from 'react';
import { DemoButton, DemoPane } from '../controls';
import { NodeBox } from './NodeBox';
import { labelOf, tree } from './tree';
import { useParentWalk, type LastStep } from './use-parent-walk';

function describe(last: LastStep | null): string {
	if (!last) return '// not started: nothing walked yet';

	switch (last.kind) {
		case 'value':
			return `// → { value: <${labelOf(last.element)}>, done: false }`;
		case 'outside':
			return `// → { value: <${last.element.localName}>, … } is outside this demo; the walk would go on up to <html>`;
		case 'done':
			return '// → { value: undefined, done: true }';
	}
}

/** Nested boxes; pick one and pull its ancestors from a real getParents generator */
export function GetParentsDemo() {
	const root = useRef<HTMLDivElement>(null);
	const { start, yielded, last, finished, select, next, runAll } = useParentWalk(root);
	const order = useMemo(() => new Map(yielded.map((element, index) => [element.dataset['node']!, index + 1])), [yielded]);
	const startLabel = start ? labelOf(start) : 'element';

	return (
		<div className="overflow-hidden rounded-xl border border-neutral-40">
			<div className="flex flex-col divide-y divide-neutral-40 md:flex-row md:divide-x md:divide-y-0">
				<DemoPane title="Pick a start element">
					<div ref={root}>
						<NodeBox node={tree} startId={start?.dataset['node']} order={order} onSelect={select} />
					</div>
				</DemoPane>

				<DemoPane title="Yielded, closest first">
					{yielded.length ? (
						<ol className="space-y-1 font-mono text-xs">
							{yielded.map((element, index) => (
								<li key={element.dataset['node']} className="flex items-center gap-2">
									<span className="inline-flex size-4 items-center justify-center rounded-full bg-secondary-550 font-sans text-[10px] font-semibold text-white">
										{index + 1}
									</span>
									&lt;{labelOf(element)}&gt;
								</li>
							))}
						</ol>
					) : (
						<p className="text-xs text-neutral-550">{start ? 'Nothing pulled yet. Press next().' : 'Click a label on the left to start.'}</p>
					)}
				</DemoPane>
			</div>

			<div className="space-y-2 border-t border-neutral-40 bg-neutral-10 px-4 py-3">
				<div className="flex flex-wrap items-center gap-2">
					<DemoButton onClick={next} disabled={!start || finished}>parents.next()</DemoButton>
					<DemoButton onClick={runAll} disabled={!start || finished}>for…of (run all)</DemoButton>
					{start && <DemoButton onClick={() => select(start)} className="ml-auto">Restart</DemoButton>}
				</div>
				<pre className="overflow-x-auto font-mono text-xs text-neutral-660">
					{`const parents = getParents(${startLabel});\n${describe(last)}`}
				</pre>
			</div>
		</div>
	);
}
