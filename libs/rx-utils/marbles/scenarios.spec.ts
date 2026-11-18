import { parseLane, parseSubscription } from './parse';
import { runScenario } from './run';
import { scenarios } from './scenarios';
import { initialState } from './state';

/** Every scenario, as `[entry id, scenario id, scenario]` */
const cases = Object.entries(scenarios).flatMap(([entryId, list]) => list.map((scenario) => [entryId, scenario.id, scenario] as const));

describe('marble scenarios', () => {
	it.each(cases)('%s › %s emits what it promises', async (_entryId, _id, scenario) => {
		const result = await runScenario(scenario, initialState(scenario));

		expect(result.error).toBeUndefined();
		expect(result.outputs.map((output) => output.events)).toEqual(
			scenario.expected.map((lane) => parseLane(lane.marbles, lane.values, lane.error)),
		);
	});

	it.each(cases.filter(([, , scenario]) => scenario.expectedSubscriptions))('%s › %s subscribes its inputs as promised', async (_entryId, _id, scenario) => {
		const result = await runScenario(scenario, initialState(scenario));

		for (const [input, marbles] of Object.entries(scenario.expectedSubscriptions ?? {})) {
			expect(result.subscriptions[input]).toEqual((marbles as string[]).map(parseSubscription));
		}
	});

	it.each(cases)('%s › %s has one expectation per subscriber', (_entryId, _id, scenario) => {
		expect(scenario.expected).toHaveLength(initialState(scenario).subscribers.length);
	});
});
