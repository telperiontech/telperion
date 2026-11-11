import type { Configuration, RuleSetRule } from 'webpack';

interface SwcOptions {
	/** Compile JSX with React's automatic runtime */
	react?: boolean;
}

/**
 * Lit's legacy decorators (and optionally React's automatic JSX runtime) for builds using
 * `"compiler": "swc"`, on top of the options `overrideTsCompilerOptions` sets.
 */
export function configureSwcForLit(config: Configuration, { react = false }: SwcOptions = {}): void {
	for (const rule of config.module?.rules ?? []) {
		const loaderRule = rule as RuleSetRule & { loader?: string; options?: Record<string, any> };

		if (!loaderRule?.loader?.includes('swc-loader')) continue;

		const jsc = (loaderRule.options ??= {}).jsc ?? {};

		loaderRule.options['jsc'] = {
			...jsc,
			parser: { ...jsc.parser, syntax: 'typescript', decorators: true, ...(react ? { tsx: true } : {}) },
			transform: {
				...jsc.transform,
				legacyDecorator: true,
				...(react ? { react: { ...jsc.transform?.react, runtime: 'automatic' } } : {}),
			},
		};
	}
}
