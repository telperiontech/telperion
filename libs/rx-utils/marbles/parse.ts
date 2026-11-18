import { TestScheduler } from 'rxjs/testing';
import type { LaneEvent, SubscriptionWindow } from './types';

/** Outside `run()` the parser counts 10 frames per dash; marbles here always use run-mode time */
function withRunModeFrames<T>(parse: () => T): T {
	const previous = TestScheduler.frameTimeFactor;

	TestScheduler.frameTimeFactor = 1;

	try {
		return parse();
	} finally {
		TestScheduler.frameTimeFactor = previous;
	}
}

/** Parses run-mode marbles (`-a-b 5ms c-|`) into lane events */
export function parseLane(marbles: string, values?: Record<string, unknown>, error?: unknown): LaneEvent[] {
	const messages = withRunModeFrames(() => TestScheduler.parseMarbles(marbles, values, error, false, true));

	return messages.map(({ frame, notification }): LaneEvent => {
		switch (notification.kind) {
			case 'N':
				return { frame, kind: 'next', value: notification.value };
			case 'E':
				return { frame, kind: 'error', error: notification.error };
			default:
				return { frame, kind: 'complete' };
		}
	});
}

/** Parses subscription marbles (`--^---!`); without `^` the subscription starts at frame 0 */
export function parseSubscription(marbles: string): SubscriptionWindow {
	const { subscribedFrame, unsubscribedFrame } = withRunModeFrames(() => TestScheduler.parseMarblesAsSubscriptions(marbles, true));

	return {
		subscribe: subscribedFrame === Infinity ? 0 : subscribedFrame,
		...(unsubscribedFrame === Infinity ? {} : { unsubscribe: unsubscribedFrame }),
	};
}

const isTerminal = (event: LaneEvent) => event.kind !== 'next';

/** Events by frame; within a frame values come before completion or error */
export function sortEvents<E extends LaneEvent>(events: readonly E[]): E[] {
	return [...events].sort((a, b) => a.frame - b.frame || Number(isTerminal(a)) - Number(isTerminal(b)));
}
