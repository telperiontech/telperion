import { VirtualTimeScheduler, type SchedulerLike } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { createHotInput, recordSubscriber } from './lanes';
import type { AnyMarbleScenario, LaneEvent, RecordedOutput, RunResult, ScenarioState, SubscriptionWindow } from './types';

/** Frames simulated past the last input or subscription, for trailing timers and settling promises */
const RUN_OUT = 40;
/** Microtask turns per frame of the stepped engine; enough for deep `async`/`await` chains */
const MICROTASK_TURNS = 100;

interface Wiring {
	outputs: RecordedOutput[];
	subscriptions: Record<string, SubscriptionWindow[]>;
}

const lastFrame = (frames: number[]) => frames.reduce((max, frame) => Math.max(max, frame), 0);

/** Last frame the state itself mentions: input events and subscription changes */
export function stateEnd(state: ScenarioState): number {
	return lastFrame([
		...Object.values(state.inputs).flatMap((events) => events.map((event) => event.frame)),
		...state.subscribers.flatMap((window) => [window.subscribe, window.unsubscribe ?? 0]),
	]);
}

/** Inputs first (not started), then the code under test and its subscribers, then the input events */
function wire(scenario: AnyMarbleScenario, state: ScenarioState, scheduler: SchedulerLike): Wiring {
	const inputs = Object.fromEntries(Object.entries(state.inputs).map(([name, events]) => [name, createHotInput(scheduler, events)]));
	const output = scenario.run(
		Object.fromEntries(Object.entries(inputs).map(([name, input]) => [name, input.observable])),
		state.args,
		scheduler,
	);
	const outputs = state.subscribers.map((window) => ({ window, events: recordSubscriber(scheduler, output, window) }));

	Object.values(inputs).forEach((input) => input.start());

	return { outputs, subscriptions: Object.fromEntries(Object.entries(inputs).map(([name, input]) => [name, input.subscriptions])) };
}

function result(scenario: AnyMarbleScenario, state: ScenarioState, wiring: Wiring): RunResult {
	const frames = (events: LaneEvent[]) => events.map((event) => event.frame);
	const end = lastFrame([
		scenario.duration ?? 0,
		stateEnd(state),
		...wiring.outputs.flatMap((output) => frames(output.events)),
		...Object.values(wiring.subscriptions).flatMap((windows) => windows.flatMap((window) => [window.subscribe, window.unsubscribe ?? 0])),
	]);

	return { ...wiring, end };
}

const failure = (error: unknown): RunResult => ({ outputs: [], subscriptions: {}, end: 0, error: error instanceof Error ? error.message : String(error) });

/** Runs synchronously on a `TestScheduler` in run mode: every RxJS timer uses virtual time */
export function runVirtual(scenario: AnyMarbleScenario, state: ScenarioState): RunResult {
	const scheduler = new TestScheduler(() => undefined);

	try {
		return scheduler.run(() => {
			// run() lifts the frame limit; keep endless timers (interval, repeat) from spinning forever
			scheduler.maxFrames = stateEnd(state) + RUN_OUT;

			const wiring = wire(scenario, state, scheduler);

			// The callback returns before run() flushes, so read the recordings afterwards through this getter
			return () => result(scenario, state, wiring);
		})();
	} catch (error) {
		return failure(error);
	}
}

async function settleMicrotasks(): Promise<void> {
	for (let turn = 0; turn < MICROTASK_TURNS; turn++) await null;
}

/**
 * Advances a virtual clock one frame at a time and lets promises settle between frames, so
 * `async`/`await` code (e.g. `for await`) is recorded at the frame it resumes on. Only timers
 * scheduled on the `scheduler` handed to `run` are virtual.
 */
export async function runStepped(scenario: AnyMarbleScenario, state: ScenarioState): Promise<RunResult> {
	const scheduler = new VirtualTimeScheduler();
	const horizon = stateEnd(state) + RUN_OUT;
	const due = (frame: number) => scheduler.actions.some((action) => (action as unknown as { delay: number }).delay <= frame);

	try {
		const wiring = wire(scenario, state, scheduler);

		for (let frame = 0; frame <= horizon; frame++) {
			scheduler.frame = frame;
			scheduler.maxFrames = frame;

			do {
				scheduler.flush();
				await settleMicrotasks();
			} while (due(frame));
		}

		return result(scenario, state, wiring);
	} catch (error) {
		return failure(error);
	}
}

/** Runs a scenario with the engine it asks for */
export function runScenario(scenario: AnyMarbleScenario, state: ScenarioState): Promise<RunResult> {
	return scenario.engine === 'stepped' ? runStepped(scenario, state) : Promise.resolve(runVirtual(scenario, state));
}
