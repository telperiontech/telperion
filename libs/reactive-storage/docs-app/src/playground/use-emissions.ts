import { useEffect, useState } from 'react';
import type { ReactiveStorage } from '@telperion/reactive-storage/reactive-storage';
import { DEMO_STORE } from './demo-storage';

export interface Emission {
	/** Increasing per subscriber, for keys and "#n" labels */
	seq: number;
	value: unknown;
}

/** How many emissions a subscriber keeps on screen */
const KEEP = 6;

/** Subscribes to `storage.get(DEMO_STORE, path)` while mounted; newest emission first */
export function useEmissions(storage: ReactiveStorage, path: string): Emission[] {
	const [emissions, setEmissions] = useState<Emission[]>([]);

	useEffect(() => {
		let seq = 0;

		setEmissions([]);

		const subscription = storage.get(DEMO_STORE, path).subscribe((value) => {
			seq += 1;

			const emission = { seq, value };

			setEmissions((current) => [emission, ...current].slice(0, KEEP));
		});

		return () => subscription.unsubscribe();
	}, [storage, path]);

	return emissions;
}
