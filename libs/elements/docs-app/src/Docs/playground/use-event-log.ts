import { useCallback, useState } from 'react';
import type { EventMessage } from '../../protocol/messages';

export interface LoggedEvent extends EventMessage {
	id: number;
	time: string;
}

const MAX_EVENTS = 50;
let nextId = 0;

/** Most recent events first, capped so a chatty element cannot grow the list forever */
export function useEventLog() {
	const [events, setEvents] = useState<LoggedEvent[]>([]);

	const log = useCallback((event: EventMessage) => {
		const time = new Date().toLocaleTimeString('en', { hour12: false });

		setEvents((current) => [{ ...event, id: nextId++, time }, ...current].slice(0, MAX_EVENTS));
	}, []);
	const clear = useCallback(() => setEvents([]), []);

	return { events, log, clear };
}
