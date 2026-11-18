import { parseLane, parseSubscription } from './parse';
import type { AnyMarbleScenario, ScenarioState, SubscriberSpec } from './types';

const DEFAULT_SUBSCRIBERS: SubscriberSpec[] = [{ label: 'output', marbles: '^' }];

/** Subscribers of a scenario, with the implicit single `output` subscriber filled in */
export const subscribersOf = (scenario: AnyMarbleScenario): SubscriberSpec[] => scenario.subscribers ?? DEFAULT_SUBSCRIBERS;

/** The scenario as authored: parsed inputs, subscriber windows and default args */
export function initialState(scenario: AnyMarbleScenario): ScenarioState {
	return {
		inputs: Object.fromEntries(
			Object.entries(scenario.inputs).map(([name, input]) => [name, parseLane(input.marbles, input.values, input.error)]),
		),
		subscribers: subscribersOf(scenario).map((subscriber) => parseSubscription(subscriber.marbles)),
		args: Object.fromEntries(Object.entries(scenario.args ?? {}).map(([name, arg]) => [name, arg.default])),
	};
}
