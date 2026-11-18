import { shareLast } from '@telperion/rx-utils/operators/share-last';
import { defineScenario } from '../../define';

const code = () => `import { shareLast } from '@telperion/rx-utils/operators';

const shared$ = source$.pipe(shareLast());

shared$.subscribe(a);  // connects the source
shared$.subscribe(b);  // starts with the latest value`;

export const lateSubscriber = defineScenario({
	id: 'late-subscriber',
	title: 'Late subscribers get the latest value',
	description: 'The source is connected once. It stays connected after `A` leaves, and `B` starts with the value it missed most recently.',
	inputs: { source: { marbles: '-a--b--c--d--e--|' } },
	subscribers: [
		{ label: 'A', marbles: '^-----!' },
		{ label: 'B', marbles: '--------^' },
	],
	operator: () => 'shareLast()',
	code,
	run: ({ source }) => source.pipe(shareLast()),
	expected: [{ marbles: '-a--b-' }, { marbles: '--------c-d--e--|' }],
	expectedSubscriptions: { source: ['^---------------!'] },
});

export const afterCompletion = defineScenario({
	id: 'after-completion',
	title: 'Replays after completion',
	description: 'Once the source has completed, every new subscriber receives its last value and completes at once.',
	inputs: { source: { marbles: '-a--b--|' } },
	subscribers: [
		{ label: 'A', marbles: '^' },
		{ label: 'B', marbles: '-----------^' },
	],
	operator: () => 'shareLast()',
	code,
	run: ({ source }) => source.pipe(shareLast()),
	expected: [{ marbles: '-a--b--|' }, { marbles: '-----------(b|)' }],
	expectedSubscriptions: { source: ['^------!'] },
});

export default [lateSubscriber, afterCompletion];
