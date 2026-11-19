import { useEffect, useId, useState, type FormEvent } from 'react';
import { CodeBlock, Panel, PanelAction } from '@osw/docs';
import { createDemoStorages, DEMO_STORE, type DemoKind, type DemoStorages } from './demo-storage';
import { RawView } from './RawView';
import { actionClass, fieldClass } from './styles';
import { SubscriberLog } from './SubscriberLog';
import { WritePanel, type WriteCall } from './WritePanel';

interface Subscriber {
	id: number;
	path: string;
	linked: boolean;
}

function initialSubscribers(hasLinked: boolean): Subscriber[] {
	return [
		{ id: 1, path: '', linked: false },
		{ id: 2, path: 'profile.name', linked: false },
		...(hasLinked ? [{ id: 3, path: 'profile.name', linked: true }] : []),
	];
}

/** Writes on the left; live subscribers and the raw stored value on the right */
export function StoragePlayground({ kind }: { kind: DemoKind }) {
	const id = useId();
	const [demo, setDemo] = useState<DemoStorages>();
	const [subscribers, setSubscribers] = useState(() => initialSubscribers(kind === 'cookie'));
	const [newPath, setNewPath] = useState('profile');
	const [lastCall, setLastCall] = useState<WriteCall>();

	// Created in an effect so every mount (StrictMode mounts twice) owns, and releases, its own instances
	useEffect(() => {
		const created = createDemoStorages(kind);

		setDemo(created);

		return created.dispose;
	}, [kind]);

	if (!demo) return null;

	const addSubscriber = (event: FormEvent) => {
		event.preventDefault();
		setSubscribers((current) => [...current, { id: Math.max(0, ...current.map((s) => s.id)) + 1, path: newPath.trim(), linked: false }]);
	};
	const clearStore = async () => {
		await demo.storage.delete(DEMO_STORE);
		setLastCall({ code: `await storage.delete('${DEMO_STORE}');` });
	};

	return (
		<div className="mt-4 grid gap-4 lg:grid-cols-2">
			<Panel
				id={`${id}-write`}
				icon="edit"
				title="Write"
				actions={<PanelAction icon="delete_sweep" onClick={clearStore}>Clear store</PanelAction>}
			>
				<WritePanel storage={demo.storage} onCall={setLastCall} />
				{lastCall && (
					<div className="border-t border-neutral-100 px-4 py-3">
						<CodeBlock code={lastCall.code} copyable={false} />
						{lastCall.error && <p role="alert" className="mt-2 font-mono text-xs text-danger-800">{lastCall.error}</p>}
					</div>
				)}
			</Panel>

			<Panel id={`${id}-read`} icon="visibility" title="Subscribers">
				<ul className="divide-y divide-neutral-100">
					{subscribers.map((subscriber) => (
						<SubscriberLog
							key={subscriber.id}
							storage={subscriber.linked && demo.linked ? demo.linked : demo.storage}
							path={subscriber.path}
							instance={demo.linked ? (subscriber.linked ? 'linked instance' : 'storage') : undefined}
							onRemove={() => setSubscribers((current) => current.filter((candidate) => candidate !== subscriber))}
						/>
					))}
				</ul>
				<form onSubmit={addSubscriber} className="flex gap-2 border-t border-neutral-100 px-4 py-3">
					<label htmlFor={`${id}-path`} className="sr-only">Key path to subscribe to</label>
					<input id={`${id}-path`} value={newPath} placeholder="key path" spellCheck={false} onChange={(event) => setNewPath(event.target.value)} className={fieldClass} />
					<button type="submit" className={`${actionClass()} shrink-0`}>Subscribe</button>
				</form>
				<RawView kind={kind} storage={demo.storage} />
			</Panel>
		</div>
	);
}
