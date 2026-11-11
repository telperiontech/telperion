import { bundledLanguages } from "shiki/langs";

import type { LanguageLoader } from "./language-loader";

/**
 * Loads any Shiki-bundled language (ids and aliases) through its own dynamic
 * `import()`, so bundlers split every grammar into a separate lazy chunk and
 * consumers only download the languages they actually render.
 */
export const bundledLanguageLoader: LanguageLoader = async name => {
  if (!Object.hasOwn(bundledLanguages, name)) return undefined;

  const module = await bundledLanguages[name as keyof typeof bundledLanguages]();

  return module.default;
};
