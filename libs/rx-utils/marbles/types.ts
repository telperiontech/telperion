import type { Observable, SchedulerLike } from 'rxjs';

/** One notification on a lane, at a virtual frame (1 frame = 1 virtual ms) */
export type LaneEvent =
	| { frame: number; kind: 'next'; value: unknown }
	| { frame: number; kind: 'complete' }
	| { frame: number; kind: 'error'; error: unknown };

/** When a subscription is active; without `unsubscribe` it lasts until the end of the timeline */
export interface SubscriptionWindow {
	subscribe: number;
	unsubscribe?: number;
}

/** A source lane. Inputs are hot: their frames are absolute, whoever subscribes and whenever */
export interface InputSpec {
	/** Lane caption; defaults to the input's key */
	label?: string;
	/** Run-mode marble notation, e.g. `-a-b 5ms c-|` */
	marbles: string;
	/** Values of the marble characters; without them each character is its own value */
	values?: Record<string, unknown>;
	/** Value of `#` */
	error?: unknown;
	/** Marble label of a value; defaults to the scenario's `format` */
	format?: (value: unknown) => string;
}

/** A subscriber of the scenario's output, e.g. `{ label: 'late', marbles: '-----^' }` */
export interface SubscriberSpec {
	label: string;
	/** Subscription marbles: `^` subscribes, `!` unsubscribes */
	marbles: string;
}

export type ArgControl =
	| { type: 'range'; min: number; max: number; step?: number }
	| { type: 'select'; options: readonly string[] }
	| { type: 'boolean' };

/** An operator argument the playground lets readers change */
export interface ArgSpec<V> {
	default: V;
	control: ArgControl;
	description?: string;
}

/** Expected notifications of one subscriber, in absolute frames (as `expectObservable(...).toBe`) */
export interface ExpectedLane {
	marbles: string;
	values?: Record<string, unknown>;
	error?: unknown;
}

export type ScenarioArgs = Record<string, unknown>;

/**
 * One marble diagram of a library export: hot inputs, the code under test, its subscribers and
 * the expected outcome. The same object drives the library's marble tests and the docs playground.
 */
export interface MarbleScenario<I extends string = string, A extends ScenarioArgs = ScenarioArgs> {
	/** URL-safe id, unique within the entry */
	id: string;
	title: string;
	/** One or two sentences under the diagram (markdown inline code allowed) */
	description?: string;
	/**
	 * `virtual` (default) runs everything synchronously on a `TestScheduler` in run mode, so
	 * time-based operators use virtual time. `stepped` advances frame by frame and lets promises
	 * settle in between, for code built on `async`/`await`; time then only passes through `scheduler`.
	 */
	engine?: 'virtual' | 'stepped';
	inputs: Record<I, InputSpec>;
	/** Defaults to one subscriber, `output`, subscribed at frame 0 */
	subscribers?: SubscriberSpec[];
	args?: { [K in keyof A]: ArgSpec<A[K]> };
	/** Caption of the operator box, e.g. `debounceTimeBuffer(3)` */
	operator: (args: A) => string;
	/** Usage snippet shown next to the diagram */
	code?: (args: A) => string;
	/** Builds the observable under test from the inputs; their value types are the scenario's business */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	run: (inputs: { [K in I]: Observable<any> }, args: A, scheduler: SchedulerLike) => Observable<unknown>;
	/** One per subscriber, for the default inputs and args */
	expected: ExpectedLane[];
	/** Expected subscriptions of each input, as subscription marbles (`^---!`) */
	expectedSubscriptions?: Partial<Record<I, string[]>>;
	/** Minimum timeline length in frames, e.g. to show that nothing happens after the inputs end */
	duration?: number;
	/** Marble label of output values */
	format?: (value: unknown) => string;
}

/** A scenario with its types erased, as stored in registries */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyMarbleScenario = MarbleScenario<any, any>;

/** The editable part of a scenario: what the playground changes and the engine runs */
export interface ScenarioState {
	inputs: Record<string, LaneEvent[]>;
	subscribers: SubscriptionWindow[];
	args: ScenarioArgs;
}

export interface RecordedOutput {
	window: SubscriptionWindow;
	events: LaneEvent[];
}

export interface RunResult {
	/** One per subscriber, in the order of `ScenarioState.subscribers` */
	outputs: RecordedOutput[];
	/** Subscriptions each input received */
	subscriptions: Record<string, SubscriptionWindow[]>;
	/** Last frame anything happened on, at least the scenario's `duration` */
	end: number;
	/** Set when the code under test threw */
	error?: string;
}
