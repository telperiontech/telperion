import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { DomClone, type DomCloneOptions } from '@telperion/dom-utils/dom-clone';

/**
 * Keeps a DomClone of `target` mounted in `host`. A new DomClone (a fresh clone of the
 * target's current state) is made when the target or the options change, or on `reconnect()`.
 */
export function useLiveMirror(target: Element | null, host: RefObject<HTMLElement | null>, options: Required<DomCloneOptions>) {
	const mirror = useRef<DomClone | null>(null);
	const [connected, setConnected] = useState(false);
	const [generation, setGeneration] = useState(0);
	const { attributes, childList, characterData } = options;

	useEffect(() => {
		const hostElement = host.current;

		if (!target || !hostElement) return;

		const next = new DomClone(target, { attributes, childList, characterData });

		hostElement.replaceChildren(next.clone);
		mirror.current = next;
		setConnected(true);

		return () => {
			next.disconnect();
			next.clone.remove();
		};
	}, [target, host, attributes, childList, characterData, generation]);

	const disconnect = useCallback(() => {
		mirror.current?.disconnect();
		setConnected(false);
	}, []);
	const reconnect = useCallback(() => setGeneration((value) => value + 1), []);

	return { connected, disconnect, reconnect };
}
