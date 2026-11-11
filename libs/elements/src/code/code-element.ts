import { bundledLanguageLoader } from "./bundled-language-loader";
import { CodeElement } from "./code-element-base";
import { setLanguageLoader } from "./language-loader";

/**
 * Bundler entry for `<tp-code>`: grammars load lazily through Shiki's bundled
 * `import()`s, so every language becomes its own chunk.
 */
setLanguageLoader(bundledLanguageLoader);

if (!customElements.get("tp-code")) customElements.define("tp-code", CodeElement);

export { CodeElement };
