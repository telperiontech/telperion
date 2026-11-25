import { useCallback, useRef, useState, type RefObject } from 'react';
import { getParents } from '@telperion/dom-utils/get-parents';

/** Result of the last `next()` call, for display */
export type LastStep = { kind: 'value'; element: HTMLElement } | { kind: 'outside'; element: HTMLElement } | { kind: 'done' };

/**
 * Drives one `getParents` generator by hand. The walk is shown inside `root`: the first
 * ancestor outside it ends the demo (the real generator would go on up to `<html>`).
 */
export function useParentWalk(root: RefObject<HTMLElement | null>) {
	const iterator = useRef<Generator<HTMLElement> | null>(null);
	const [start, setStart] = useState<HTMLElement | null>(null);
	const [yielded, setYielded] = useState<HTMLElement[]>([]);
	const [last, setLast] = useState<LastStep | null>(null);
	const select = useCallback((element: HTMLElement) => {
		iterator.current?.return(undefined);
		iterator.current = getParents(element);
		setStart(element);
		setYielded([]);
		setLast(null);
	}, []);
	/** Pulls one value; returns false once the walk has left the demo or ended */
	const pull = useCallback((): boolean => {
		const walk = iterator.current;

		if (!walk) return false;

		const result = walk.next();

		if (result.done) {
			iterator.current = null;
			setLast({ kind: 'done' });

			return false;
		}

		const element = result.value;
		const inside = !!root.current && root.current !== element && root.current.contains(element);

		if (!inside) {
			walk.return(undefined);
			iterator.current = null;
			setLast({ kind: 'outside', element });

			return false;
		}

		setYielded((current) => [...current, element]);
		setLast({ kind: 'value', element });

		return true;
	}, [root]);
	const next = useCallback(() => void pull(), [pull]);
	const runAll = useCallback(() => {
		while (pull());
	}, [pull]);

	// `iterator` is a ref: `finished` is read on the re-render each pull's state update causes
	return { start, yielded, last, finished: !!start && !iterator.current, select, next, runAll };
}
