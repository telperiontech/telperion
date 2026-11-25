import { useCallback, useEffect, useRef, useState } from 'react';

export interface LoggedMutation {
	id: number;
	type: MutationRecordType;
	detail: string;
	mirrored: boolean;
}

const LIMIT = 6;

function describe(record: MutationRecord): string {
	switch (record.type) {
		case 'attributes':
			return `${record.attributeName} on <${(record.target as Element).localName}>`;
		case 'characterData':
			return `"${record.target.nodeValue}"`;
		case 'childList': {
			const parts = [record.addedNodes.length && `+${record.addedNodes.length}`, record.removedNodes.length && `−${record.removedNodes.length}`];

			return `${parts.filter(Boolean).join(' ')} on <${(record.target as Element).localName}>`;
		}
	}
}

/**
 * The latest mutations of `target`, each marked with whether the mirror took it:
 * `isMirrored` is read when the record arrives, so it reflects the options and connection then.
 */
export function useMutationLog(target: Element | null, isMirrored: (type: MutationRecordType) => boolean) {
	const [log, setLog] = useState<LoggedMutation[]>([]);
	const check = useRef(isMirrored);
	const nextId = useRef(0);

	check.current = isMirrored;

	useEffect(() => {
		if (!target) return;

		setLog([]);

		const observer = new MutationObserver((records) => {
			const entries = records.map((record) => ({
				id: nextId.current++,
				type: record.type,
				detail: describe(record),
				mirrored: check.current(record.type),
			}));

			setLog((current) => [...entries.reverse(), ...current].slice(0, LIMIT));
		});

		observer.observe(target, { attributes: true, childList: true, characterData: true, subtree: true });

		return () => observer.disconnect();
	}, [target]);

	const clear = useCallback(() => setLog([]), []);

	return { log, clear };
}
