import type { EventMessage } from '../protocol/messages';

const MAX_SUMMARY = 160;

function safeJson(value: unknown): string {
	try {
		const json = JSON.stringify(value, (_, item) => (item instanceof Node ? `<${item.nodeName.toLowerCase()}>` : item instanceof WeakRef ? 'WeakRef' : item));

		return json === undefined ? String(value) : json;
	} catch {
		return String(value);
	}
}

/** Short, printable description of what an event carries */
function summarize(event: Event): string | undefined {
	if (event instanceof CustomEvent && event.detail !== undefined && event.detail !== null) return safeJson(event.detail);

	const value = (event as Event & { value?: unknown }).value ?? (event.target as { value?: unknown } | null)?.value;

	return value === undefined ? undefined : `value: ${safeJson(value)}`;
}

const truncate = (text: string | undefined) => (text && text.length > MAX_SUMMARY ? `${text.slice(0, MAX_SUMMARY - 1)}…` : text);

/**
 * Logs the given events to `post` while active. Listeners capture at the document so
 * non-bubbling events are seen too. Returns a function that removes them.
 */
export function listenToEvents(names: readonly string[], post: (message: EventMessage) => void): () => void {
	const listener = (event: Event) => {
		const target = event.composedPath()[0];

		post({
			type: 'osw-preview:event',
			name: event.type,
			target: target instanceof Element ? target.localName : 'document',
			summary: truncate(summarize(event)),
		});
	};

	for (const name of names) document.addEventListener(name, listener, true);

	return () => {
		for (const name of names) document.removeEventListener(name, listener, true);
	};
}

/**
 * A submitted story form would navigate the iframe away from the preview.
 * Runs last (bubbling, on window) so stories that handle `submit` themselves are unaffected.
 */
export function preventFormNavigation(): void {
	window.addEventListener('submit', (event) => {
		if (!event.defaultPrevented) event.preventDefault();
	});
}
