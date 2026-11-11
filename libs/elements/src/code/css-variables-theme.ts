import { createCssVariablesTheme } from "shiki/core";

/** Name the theme is registered under in the shared highlighter. */
export const CODE_THEME_NAME = "tp-code";

/**
 * Shiki theme whose colors are CSS variables instead of hex values, e.g.
 * `var(--_tp-code-token-keyword)`.
 *
 * The private `--_tp-code-*` variables are resolved on `:host` from the public
 * `--tp-code-*` ones (with palette-based fallbacks, see `styles.ts`). The
 * indirection lets consumers set the public variables on **any** ancestor
 * instead of only on `tp-code` itself.
 */
export const cssVariablesTheme = createCssVariablesTheme({
  name: CODE_THEME_NAME,
  variablePrefix: "--_tp-code-",
  fontStyle: true,
});
