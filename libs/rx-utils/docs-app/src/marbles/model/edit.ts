import { sortEvents, type SubscriptionWindow } from '../engine';
import { eventId, type EditableState, type MarbleEvent } from './editable';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const terminalOf = (events: readonly MarbleEvent[]) => events.find((event) => event.kind !== 'next');
const lastValueFrame = (events: readonly MarbleEvent[]) =>
	events.reduce((last, event) => (event.kind === 'next' ? Math.max(last, event.frame) : last), 0);

function withLane(state: EditableState, input: string, events: MarbleEvent[]): EditableState {
	return { ...state, inputs: { ...state.inputs, [input]: sortEvents(events) } };
}

/**
 * Moves an input event to `frame`, up to `limit`. Values stay at or before the lane's completion
 * or error, and the completion or error stays at or after the last value.
 */
export function moveEvent(state: EditableState, input: string, id: string, frame: number, limit: number): EditableState {
	const events = state.inputs[input] ?? [];
	const event = events.find((candidate) => candidate.id === id);

	if (!event) return state;

	const others = events.filter((candidate) => candidate !== event);
	const terminal = terminalOf(others);
	const target = event.kind === 'next' ? clamp(frame, 0, terminal?.frame ?? limit) : clamp(frame, lastValueFrame(others), limit);

	if (target === event.frame) return state;

	return withLane(state, input, events.map((candidate) => (candidate === event ? { ...candidate, frame: target } : candidate)));
}

export function removeEvent(state: EditableState, input: string, id: string): EditableState {
	return withLane(state, input, (state.inputs[input] ?? []).filter((event) => event.id !== id));
}

/** Adds a value at `frame`, or at the lane's completion when `frame` is after it */
export function addValue(state: EditableState, input: string, frame: number, value: unknown): EditableState {
	const events = state.inputs[input] ?? [];
	const terminal = terminalOf(events);
	const at = terminal ? Math.min(frame, terminal.frame) : frame;

	return withLane(state, input, [...events, { id: eventId(), frame: at, kind: 'next', value }]);
}

/** The first free frame after the last value, else the first free frame at all, before the lane ends */
export function freeFrame(events: readonly MarbleEvent[], limit: number): number {
	const end = terminalOf(events)?.frame ?? limit;
	const taken = new Set(events.map((event) => event.frame));
	const frames = Array.from({ length: end + 1 }, (_, frame) => frame);
	const after = lastValueFrame(events);

	return frames.find((frame) => frame > after && !taken.has(frame)) ?? frames.find((frame) => !taken.has(frame)) ?? end;
}

export type WindowEdge = 'subscribe' | 'unsubscribe';

/** Moves a subscriber's subscribe or unsubscribe point, keeping at least one frame between them */
export function moveWindow(state: EditableState, index: number, edge: WindowEdge, frame: number, limit: number): EditableState {
	const window = state.subscribers[index];

	if (!window) return state;

	const next: SubscriptionWindow =
		edge === 'subscribe'
			? { ...window, subscribe: clamp(frame, 0, (window.unsubscribe ?? limit + 1) - 1) }
			: { ...window, unsubscribe: clamp(frame, window.subscribe + 1, limit) };

	if (next.subscribe === window.subscribe && next.unsubscribe === window.unsubscribe) return state;

	return { ...state, subscribers: state.subscribers.map((candidate, position) => (position === index ? next : candidate)) };
}
