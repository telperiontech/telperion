import { initialState, type AnyMarbleScenario, type InputSpec, type LaneEvent, type ScenarioState } from '../engine';

/** A lane event with a stable id, so a marble keeps its identity while it is dragged and re-sorted */
export type MarbleEvent = LaneEvent & { id: string };

export interface EditableState extends ScenarioState {
	inputs: Record<string, MarbleEvent[]>;
}

let lastId = 0;

export const eventId = () => `marble-${++lastId}`;

/** The scenario's authored state, with ids on every input event */
export function editableState(scenario: AnyMarbleScenario): EditableState {
	const state = initialState(scenario);

	return {
		...state,
		inputs: Object.fromEntries(Object.entries(state.inputs).map(([name, events]) => [name, events.map((event) => ({ ...event, id: eventId() }))])),
	};
}

const ALPHABET = [...'abcdefghijklmnopqrstuvwxyz'];

/** Values a reader can add to an input lane: its declared values, or letters */
export function valuePool(spec: InputSpec): unknown[] {
	return spec.values ? Object.values(spec.values) : ALPHABET;
}

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** The first pool value not on the lane yet, else the pool in turn */
export function nextValue(pool: readonly unknown[], events: readonly LaneEvent[]): unknown {
	const used = events.flatMap((event) => (event.kind === 'next' ? [event.value] : []));

	return pool.find((value) => !used.some((existing) => same(existing, value))) ?? pool[used.length % pool.length];
}
