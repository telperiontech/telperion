import { Observable, Subject, type SchedulerLike, type Subscription } from 'rxjs';
import { sortEvents } from './parse';
import type { LaneEvent, SubscriptionWindow } from './types';

export interface HotInput {
	observable: Observable<unknown>;
	/** Filled while the scheduler runs */
	subscriptions: SubscriptionWindow[];
	/** Schedules the lane's events; call after the subscribers, so same-frame subscribers see them */
	start: () => void;
}

/** A hot observable that emits `events` at their absolute frames and logs who subscribes when */
export function createHotInput(scheduler: SchedulerLike, events: readonly LaneEvent[]): HotInput {
	const subject = new Subject<unknown>();
	const subscriptions: SubscriptionWindow[] = [];
	const observable = new Observable<unknown>((subscriber) => {
		const window: SubscriptionWindow = { subscribe: scheduler.now() };

		subscriptions.push(window);

		const inner = subject.subscribe(subscriber);

		return () => {
			inner.unsubscribe();
			window.unsubscribe = scheduler.now();
		};
	});
	const deliver = (event: LaneEvent) => {
		if (event.kind === 'next') subject.next(event.value);
		else if (event.kind === 'error') subject.error(event.error);
		else subject.complete();
	};

	return {
		observable,
		subscriptions,
		start: () => sortEvents(events).forEach((event) => scheduler.schedule(() => deliver(event), event.frame)),
	};
}

/** Subscribes `source` during `window` and records what it emits */
export function recordSubscriber(scheduler: SchedulerLike, source: Observable<unknown>, window: SubscriptionWindow): LaneEvent[] {
	const events: LaneEvent[] = [];
	let subscription: Subscription | undefined;

	scheduler.schedule(() => {
		subscription = source.subscribe({
			next: (value) => events.push({ frame: scheduler.now(), kind: 'next', value }),
			error: (error: unknown) => events.push({ frame: scheduler.now(), kind: 'error', error }),
			complete: () => events.push({ frame: scheduler.now(), kind: 'complete' }),
		});
	}, window.subscribe);

	if (window.unsubscribe !== undefined) scheduler.schedule(() => subscription?.unsubscribe(), window.unsubscribe);

	return events;
}
