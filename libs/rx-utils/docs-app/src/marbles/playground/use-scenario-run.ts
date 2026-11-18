import { useEffect, useState } from 'react';
import { runScenario, runVirtual, type AnyMarbleScenario, type RunResult, type ScenarioState } from '../engine';

/**
 * Runs the scenario whenever its state changes and keeps the latest finished run. Virtual runs
 * are synchronous, so the first paint already has outputs; stepped runs arrive a moment later.
 */
export function useScenarioRun(scenario: AnyMarbleScenario, state: ScenarioState): RunResult | undefined {
	const [result, setResult] = useState<RunResult | undefined>(() => (scenario.engine === 'stepped' ? undefined : runVirtual(scenario, state)));

	useEffect(() => {
		let current = true;

		runScenario(scenario, state).then((next) => {
			if (current) setResult(next);
		});

		return () => {
			current = false;
		};
	}, [scenario, state]);

	return result;
}
