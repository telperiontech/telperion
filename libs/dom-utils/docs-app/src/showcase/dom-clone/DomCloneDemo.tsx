import { useEffect, useRef, useState } from 'react';
import type { DomCloneOptions } from '@telperion/dom-utils/dom-clone';
import { DemoButton, DemoCheckbox, DemoPane } from '../controls';
import { MutationLog } from './MutationLog';
import { createSourceCard, type SourceCard } from './source-card';
import { useLiveMirror } from './use-live-mirror';
import { useMutationLog } from './use-mutation-log';

type Options = Required<DomCloneOptions>;

const optionLabels: Record<keyof Options, string> = {
	attributes: 'attributes',
	childList: 'childList',
	characterData: 'characterData',
};

/** Source card, its live DomClone, and a log of which source mutations the clone took */
export function DomCloneDemo() {
	const sourceHost = useRef<HTMLDivElement>(null);
	const mirrorHost = useRef<HTMLDivElement>(null);
	const [card, setCard] = useState<SourceCard | null>(null);
	const [resets, setResets] = useState(0);
	const [options, setOptions] = useState<Options>({ attributes: true, childList: true, characterData: true });

	useEffect(() => {
		const next = createSourceCard();

		sourceHost.current?.replaceChildren(next.element);
		setCard(next);

		return () => next.element.remove();
	}, [resets]);

	const target = card?.element ?? null;
	const { connected, disconnect, reconnect } = useLiveMirror(target, mirrorHost, options);
	const { log } = useMutationLog(target, (type) => connected && options[type]);

	return (
		<div className="overflow-hidden rounded-xl border border-neutral-40">
			<div className="flex flex-wrap items-center gap-2 border-b border-neutral-40 bg-neutral-10 px-4 py-3">
				<DemoButton onClick={() => card?.toggleState()}>Toggle data-state</DemoButton>
				<DemoButton onClick={() => card?.recolor()}>Change style.color</DemoButton>
				<DemoButton onClick={() => card?.nextStatus()}>Next status text</DemoButton>
				<DemoButton onClick={() => card?.addItem()}>Add item</DemoButton>
				<DemoButton onClick={() => card?.removeItem()}>Remove item</DemoButton>
				<DemoButton onClick={() => setResets((value) => value + 1)} className="ml-auto">Reset</DemoButton>
			</div>

			<div className="flex flex-col divide-y divide-neutral-40 sm:flex-row sm:divide-x sm:divide-y-0">
				<DemoPane title="Source (target)">
					<div ref={sourceHost} />
				</DemoPane>
				<DemoPane
					title="mirror.clone"
					aside={
						<span className={`text-[11px] font-semibold ${connected ? 'text-success-700' : 'text-neutral-550'}`}>
							{connected ? '● syncing' : '○ disconnected'}
						</span>
					}
				>
					<div ref={mirrorHost} />
				</DemoPane>
			</div>

			<div className="space-y-3 border-t border-neutral-40 px-4 py-3">
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
					<span className="text-xs font-semibold text-neutral-550">Options</span>
					{(Object.keys(optionLabels) as (keyof Options)[]).map((key) => (
						<DemoCheckbox key={key} checked={options[key]} onChange={(checked) => setOptions((current) => ({ ...current, [key]: checked }))}>
							<code>{optionLabels[key]}</code>
						</DemoCheckbox>
					))}
					<span className="ml-auto">
						{connected ? <DemoButton onClick={disconnect}>disconnect()</DemoButton> : <DemoButton onClick={reconnect}>new DomClone()</DemoButton>}
					</span>
				</div>
				<p className="text-xs text-neutral-550">
					Changing an option or reconnecting creates a new DomClone, so the clone starts again from the source as it is now.
				</p>
				<MutationLog log={log} />
			</div>
		</div>
	);
}
