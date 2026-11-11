/**
 * Webpack loader for `*.stories.ts?meta`: removes bare side-effect imports (`import './x-element';`)
 * so the docs page can read story metadata and templates without defining any custom element.
 * The unmodified stories run in the preview iframe.
 */
const SIDE_EFFECT_IMPORT = /^[ \t]*import\s+(['"])[^'"\n]+\1\s*;?[ \t]*(\/\/[^\n]*)?$/gm;

module.exports = function stripSideEffectImports(source) {
	return source.replace(SIDE_EFFECT_IMPORT, '');
};
