import type { TreeNode } from './tree';

export interface NodeBoxProps {
	node: TreeNode;
	/** id of the selected start element */
	startId: string | undefined;
	/** Yield order (1-based) by element id */
	order: Map<string, number>;
	onSelect: (box: HTMLElement) => void;
}

/** One demo element: a real nested box, selectable through its label button */
export function NodeBox({ node, startId, order, onSelect }: NodeBoxProps) {
	const step = order.get(node.id);
	const isStart = node.id === startId;
	const tone = isStart
		? 'border-tertiary-500 bg-tertiary-30'
		: step
			? 'border-secondary-400 bg-secondary-20'
			: 'border-neutral-40 bg-white';

	return (
		<div data-node={node.id} data-label={node.label} className={`min-w-0 flex-1 rounded-lg border p-2 transition-colors ${tone}`}>
			<div className="flex items-center gap-1.5">
				<button
					type="button"
					aria-pressed={isStart}
					onClick={(event) => onSelect(event.currentTarget.closest<HTMLElement>('[data-node]')!)}
					className="rounded px-1 font-mono text-[11px] text-neutral-900 hover:bg-neutral-20"
				>
					{node.label}
				</button>
				{isStart && <span className="text-[10px] font-semibold uppercase text-tertiary-700">start</span>}
				{step && (
					<span className="inline-flex size-4 items-center justify-center rounded-full bg-secondary-550 text-[10px] font-semibold text-white">
						{step}
					</span>
				)}
			</div>
			{node.children && (
				<div className="mt-2 flex flex-wrap gap-2">
					{node.children.map((child) => (
						<NodeBox key={child.id} node={child} startId={startId} order={order} onSelect={onSelect} />
					))}
				</div>
			)}
		</div>
	);
}
