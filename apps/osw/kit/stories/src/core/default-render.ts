import type { Args, RenderFn } from './types';

/**
 * Storybook's web-components fallback for stories without a `render`: the meta's
 * `component` with each primitive arg as an attribute (booleans as presence).
 */
export function defaultRender(tagName: string): RenderFn {
	return (args: Args) => {
		const element = document.createElement(tagName);

		for (const [name, value] of Object.entries(args)) {
			if (value === false || value === undefined || value === null) continue;

			if (value === true) element.setAttribute(name, '');
			else if (typeof value === 'string' || typeof value === 'number') element.setAttribute(name, String(value));
		}

		return element;
	};
}
