import { getPaintletStyleSheet } from '@telperion/paintlet';

export interface SupportReport {
	/** `CSS.paintWorklet`: the worklets can run at all */
	paintApi: boolean;
	/** `@function`: the `--tp-<name>()` helpers paintlets are used through */
	customFunctions: boolean;
	/** `CSS.registerProperty`: typed custom properties, needed to animate paintlets */
	propertyRegistration: boolean;
	/** `paint(name, args…)`: still behind a flag in Chrome; paintlets fall back to custom properties */
	paintArguments: boolean;
}

/**
 * What this browser supports. `@function` is detected from the paintlet sheet itself:
 * the library skips rules the engine cannot parse, so a surviving `@function` rule means support.
 */
export function detectSupport(): SupportReport {
	const css = typeof CSS === 'undefined' ? undefined : CSS;
	const rules = getPaintletStyleSheet()?.cssRules;

	return {
		paintApi: !!css && 'paintWorklet' in css,
		customFunctions: !!rules && [...rules].some((rule) => rule.cssText.startsWith('@function')),
		propertyRegistration: typeof css?.registerProperty === 'function',
		paintArguments: !!css?.supports?.('background-image', 'paint(tp-probe, red)'),
	};
}

/** Whether paintlets render here: the worklet API plus the CSS functions they are applied through */
export const isFullySupported = (report: SupportReport) => report.paintApi && report.customFunctions;
