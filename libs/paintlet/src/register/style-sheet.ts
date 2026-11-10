import { getGlobalState } from './global-state';
import { isBrowser } from './support';

/**
 * Returns the constructed stylesheet holding every paintlet's `@keyframes` and
 * `@function` rules. It is adopted into `document` automatically.
 *
 * `@function` and `@keyframes` are tree-scoped, so adopt this sheet into a
 * shadow root to use paintlet functions inside it:
 *
 * ```ts
 * const sheet = getPaintletStyleSheet();
 * if (sheet) shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, sheet];
 * ```
 *
 * Returns `undefined` outside the browser (e.g. during SSR).
 */
export function getPaintletStyleSheet(): CSSStyleSheet | undefined {
  if (!isBrowser() || typeof CSSStyleSheet === 'undefined') return undefined;

  const state = getGlobalState();

  if (!state.sheet) {
    state.sheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, state.sheet];
  }

  return state.sheet;
}

/**
 * Appends rules to the shared sheet one by one, so a rule the browser cannot
 * parse yet (e.g. `@function` in older engines) does not drop the others.
 */
export function insertRules(rules: readonly string[]): void {
  const sheet = getPaintletStyleSheet();

  if (!sheet) return;

  for (const rule of rules) {
    try {
      sheet.insertRule(rule, sheet.cssRules.length);
    } catch {
      // Unsupported at-rule in this engine; skip it.
    }
  }
}
