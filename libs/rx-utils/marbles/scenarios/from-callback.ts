import { fromCallback } from '@telperion/rx-utils/from-callback';
import { defineScenario } from '../define';

const callArgs = (value: unknown) => `cb(${(value as unknown[]).map((arg) => JSON.stringify(arg)).join(', ')})`;

export const firstCall = defineScenario({
	id: 'first-call',
	title: 'The first call wins',
	description: 'The observable emits the callback arguments as a tuple and completes; later calls are ignored.',
	inputs: { calls: { label: 'callback calls', marbles: '---a----b--', values: { a: ['a'], b: ['b'] }, format: callArgs } },
	operator: () => 'fromCallback(fn)',
	code: () => `import { fromCallback } from '@telperion/rx-utils';

fromCallback<(value: string) => void>((cb) => api.once('ready', cb));`,
	run: ({ calls }) => fromCallback<(value: string) => void>((cb) => calls.subscribe((args: [string]) => cb(...args))),
	expected: [{ marbles: '---(x|)', values: { x: ['a'] } }],
});

export const withMapper = defineScenario({
	id: 'with-mapper',
	title: 'Mapping node-style callbacks',
	description: 'A mapper turns the arguments into the emitted value, here the data of an `(error, data)` callback.',
	inputs: { calls: { label: 'callback calls', marbles: '----a---', values: { a: [null, 'hello'] }, format: callArgs } },
	operator: () => 'fromCallback(fn, (err, data) => data)',
	code: () => `import { fromCallback } from '@telperion/rx-utils';

fromCallback<(err: Error | null, data: string) => void>(
  (cb) => readFile('greeting.txt', 'utf8', cb),
  (_err, data) => data,
);`,
	run: ({ calls }) =>
		fromCallback<(err: Error | null, data: string) => void, (err: Error | null, data: string) => string>(
			(cb) => calls.subscribe((args: [Error | null, string]) => cb(...args)),
			(_err, data) => data,
		),
	expected: [{ marbles: '----(x|)', values: { x: 'hello' } }],
});

export default [firstCall, withMapper];
