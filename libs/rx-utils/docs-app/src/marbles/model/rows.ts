import { subscribersOf, type AnyMarbleScenario, type LaneEvent, type RunResult, type SubscriptionWindow } from '../engine';
import type { EditableState, MarbleEvent } from './editable';
import { formatValue } from './format';
import { BOTTOM_PAD, LANE_HEIGHT, OPERATOR_HEIGHT, TOP_PAD } from './geometry';

export interface InputRow {
	kind: 'input';
	name: string;
	label: string;
	/** Center line */
	y: number;
	events: MarbleEvent[];
	subscriptions: SubscriptionWindow[];
	format: (value: unknown) => string;
}

export interface OperatorRow {
	kind: 'operator';
	y: number;
	label: string;
}

export interface OutputRow {
	kind: 'output';
	index: number;
	label: string;
	y: number;
	events: LaneEvent[];
	window: SubscriptionWindow;
	/** Scenarios that declare their subscribers let readers move them */
	movable: boolean;
	format: (value: unknown) => string;
}

export type Row = InputRow | OperatorRow | OutputRow;

/** Inputs, the operator box, then one lane per subscriber, top to bottom */
export function layoutRows(scenario: AnyMarbleScenario, state: EditableState, result: RunResult | undefined): { rows: Row[]; height: number } {
	let y = TOP_PAD;
	const advance = (height: number) => {
		const center = y + height / 2;

		y += height;

		return center;
	};
	const inputs: Row[] = Object.entries(state.inputs).map(([name, events]) => {
		const spec = scenario.inputs[name];

		return {
			kind: 'input',
			name,
			label: spec?.label ?? name,
			y: advance(LANE_HEIGHT),
			events,
			subscriptions: result?.subscriptions[name] ?? [],
			format: spec?.format ?? scenario.format ?? formatValue,
		};
	});
	const operator: Row = { kind: 'operator', y: advance(OPERATOR_HEIGHT), label: scenario.operator(state.args) };
	const subscribers = subscribersOf(scenario);
	const outputs: Row[] = state.subscribers.map((window, index) => ({
		kind: 'output',
		index,
		label: subscribers[index]?.label ?? `subscriber ${index + 1}`,
		y: advance(LANE_HEIGHT),
		events: result?.outputs[index]?.events ?? [],
		window,
		movable: !!scenario.subscribers,
		format: scenario.format ?? formatValue,
	}));

	return { rows: [...inputs, operator, ...outputs], height: y + BOTTOM_PAD };
}
