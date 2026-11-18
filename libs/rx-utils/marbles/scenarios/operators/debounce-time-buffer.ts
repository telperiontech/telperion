import { debounceTimeBuffer } from '@telperion/rx-utils/operators/debounce-time-buffer';
import { defineScenario } from '../../define';

const dueTime = {
	default: 3,
	control: { type: 'range', min: 1, max: 8 },
	description: 'Frames of silence that close a burst',
} as const;
const code = ({ dueTime }: { dueTime: number }) => `import { debounceTimeBuffer } from '@telperion/rx-utils/operators';

keystrokes$.pipe(debounceTimeBuffer(${dueTime}));`;

export const bursts = defineScenario({
	id: 'bursts',
	title: 'Bursts become arrays',
	description: 'Values are collected while they keep coming; once the source has been quiet for `dueTime`, the whole burst is emitted as one array.',
	inputs: { source: { marbles: '-a-b-c-----d-e--f------|' } },
	args: { dueTime },
	operator: ({ dueTime }) => `debounceTimeBuffer(${dueTime})`,
	code,
	run: ({ source }, { dueTime }) => source.pipe(debounceTimeBuffer(dueTime)),
	expected: [{ marbles: '--------x----------y---(z|)', values: { x: ['a', 'b', 'c'], y: ['d', 'e', 'f'], z: [] } }],
	expectedSubscriptions: { source: ['^----------------------!', '^----------------------!'] },
});

export const completion = defineScenario({
	id: 'completion',
	title: 'Completion flushes the buffer',
	description: 'When the source completes, the values still waiting for silence are emitted right away, then the output completes.',
	inputs: { source: { marbles: '-a-b------c-d-|' } },
	args: { dueTime },
	operator: ({ dueTime }) => `debounceTimeBuffer(${dueTime})`,
	code,
	run: ({ source }, { dueTime }) => source.pipe(debounceTimeBuffer(dueTime)),
	expected: [{ marbles: '------x-------(y|)', values: { x: ['a', 'b'], y: ['c', 'd'] } }],
});

export default [bursts, completion];
