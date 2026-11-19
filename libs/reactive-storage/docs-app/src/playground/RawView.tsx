import { useEffect, useState } from 'react';
import type { ReactiveStorage } from '@telperion/reactive-storage/reactive-storage';
import { DEMO_STORE, rawLocation, readRaw, type DemoKind } from './demo-storage';

/** The store as the browser keeps it, re-read after every change */
export function RawView({ kind, storage }: { kind: DemoKind; storage: ReactiveStorage }) {
	const [raw, setRaw] = useState<string | null>(() => readRaw(kind));

	useEffect(() => {
		const subscription = storage.get(DEMO_STORE).subscribe(() => setRaw(readRaw(kind)));

		return () => subscription.unsubscribe();
	}, [kind, storage]);

	return (
		<div className="border-t border-neutral-100 bg-neutral-30 px-4 py-3">
			<p className="text-xs font-semibold text-neutral-990">In the browser</p>
			<p className="mt-1 font-mono text-xs text-neutral-850">{rawLocation(kind)}</p>
			<p className="mt-2 font-mono text-xs break-all text-neutral-990">{raw ?? <span className="text-neutral-850">(not set)</span>}</p>
		</div>
	);
}
