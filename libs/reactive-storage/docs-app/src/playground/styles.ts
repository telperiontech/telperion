/** Text inputs of the playground */
export const fieldClass =
	'w-full rounded-md border border-neutral-100 bg-white px-2 py-1.5 font-mono text-xs text-neutral-990 focus:border-secondary-300 focus:outline-none';

/** Small action buttons of the playground; `primary` is the main write */
export const actionClass = (primary = false) =>
	`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40 ${
		primary ? 'bg-secondary-600 text-white hover:bg-secondary-700' : 'border border-neutral-100 bg-white text-neutral-990 hover:border-neutral-250'
	}`;

/** A value as the playground shows it: JSON, with `undefined` spelled out */
export const formatValue = (value: unknown) => (value === undefined ? 'undefined' : JSON.stringify(value));
