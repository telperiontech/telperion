import type { ArgType, StoryDoc } from './types';

export type Control =
	| { kind: 'range'; min: number; max: number; step: number }
	| { kind: 'number'; min?: number; max?: number; step?: number }
	| { kind: 'color' }
	| { kind: 'select'; options: readonly string[] }
	| { kind: 'boolean' }
	| { kind: 'text' };

export interface ControlDef {
	name: string;
	control: Control;
	description?: string;
	defaultSummary?: string;
}

const SELECT_LIKE = new Set(['select', 'radio', 'inline-radio', 'check', 'inline-check', 'multi-select']);

/** Same fallback Storybook uses when an arg has no `argTypes` entry */
function inferControl(value: unknown): Control | undefined {
	if (typeof value === 'number') return { kind: 'number' };

	if (typeof value === 'boolean') return { kind: 'boolean' };

	if (typeof value === 'string' || value === undefined) return { kind: 'text' };

	// Objects, arrays and functions (e.g. event handlers) cannot be edited as text
	return undefined;
}

/** Maps an `argTypes` entry to a control; `undefined` hides the arg (`control: false`) */
export function resolveControl(argType: ArgType | undefined, value: unknown): Control | undefined {
	const control = argType?.control;

	if (control === false || argType?.table?.disable) return undefined;

	const type = typeof control === 'string' ? control : control?.type;
	const options = argType?.options?.map(String);

	if (type === 'range') {
		const { min = 0, max = 100, step = 1 } = typeof control === 'object' ? control : {};

		return { kind: 'range', min, max, step };
	}

	if (type === 'number') {
		const { min, max, step } = typeof control === 'object' ? control : {};

		return { kind: 'number', min, max, step };
	}

	if (type === 'color') return { kind: 'color' };

	if (type === 'boolean') return { kind: 'boolean' };

	if (options?.length && (!type || SELECT_LIKE.has(type))) return { kind: 'select', options };

	if (type === 'text') return { kind: 'text' };

	// Unknown control types (object, date, file, …) fall back to a text input
	return type ? { kind: 'text' } : inferControl(value);
}

/** Controls for a story, in `argTypes` order followed by args that have no `argTypes` entry */
export function controlsOf(story: StoryDoc): ControlDef[] {
	const names = [...new Set([...Object.keys(story.argTypes), ...Object.keys(story.args)])];

	return names.flatMap((name) => {
		const argType = story.argTypes[name];
		const control = resolveControl(argType, story.args[name]);

		if (!control) return [];

		return [{ name, control, description: argType?.description, defaultSummary: argType?.table?.defaultValue?.summary }];
	});
}
