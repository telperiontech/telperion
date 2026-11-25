import { mapTo } from '@telperion/rx-utils/operators/map-to';
import { defineScenario } from '../../define';

export const toConstant = defineScenario({
	id: 'to-constant',
	title: 'Every value becomes the same constant',
	description: 'Each source value is replaced by `value`; timing, completion and errors pass through unchanged.',
	inputs: { source: { marbles: '-a---b--c---|' } },
	args: {
		value: { default: 'x', control: { type: 'select', options: ['x', 'y', 'z'] }, description: 'Constant to emit' },
	},
	operator: ({ value }) => `mapTo('${value}')`,
	code: ({ value }) => `import { mapTo } from '@telperion/rx-utils/operators';

source$.pipe(mapTo('${value}'));`,
	run: ({ source }, { value }) => source.pipe(mapTo(value)),
	expected: [{ marbles: '-x---x--x---|' }],
});

export default [toConstant];
