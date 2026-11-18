import { pluck } from '@telperion/rx-utils/operators/pluck';
import { defineScenario } from '../../define';

const people = {
	a: { name: 'Ada', born: 1815 },
	b: { name: 'Alan', born: 1912 },
	c: { name: 'Grace', born: 1906 },
};

export const byKey = defineScenario({
	id: 'by-key',
	title: 'One property of each value',
	description: 'Every object is mapped to the value of `key`, with the property type inferred from the source.',
	inputs: {
		source: {
			marbles: '-a-----b-----c----|',
			values: people,
			format: (value) => {
				const { name, born } = value as (typeof people)['a'];

				return `${name}, ${born}`;
			},
		},
	},
	args: {
		key: { default: 'name', control: { type: 'select', options: ['name', 'born'] }, description: 'Property to emit' },
	},
	operator: ({ key }) => `pluck('${key}')`,
	code: ({ key }) => `import { pluck } from '@telperion/rx-utils/operators';

people$.pipe(pluck('${key}'));`,
	run: ({ source }, { key }) => source.pipe(pluck(key as keyof typeof people.a)),
	expected: [{ marbles: '-a-----b-----c----|', values: { a: 'Ada', b: 'Alan', c: 'Grace' } }],
});

export default [byKey];
