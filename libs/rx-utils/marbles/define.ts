import type { MarbleScenario, ScenarioArgs } from './types';

/** Identity helper that infers a scenario's input names and arg types */
export function defineScenario<I extends string, A extends ScenarioArgs = Record<string, never>>(scenario: MarbleScenario<I, A>): MarbleScenario<I, A> {
	return scenario;
}
