import { createHighlighterCore, type HighlighterCore, type ThemedToken } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

import { CODE_THEME_NAME, cssVariablesTheme } from "./css-variables-theme";
import { getLanguageLoader } from "./language-loader";

/** Language names that intentionally render as plain text (no warning). */
const PLAIN_LANGUAGES = new Set(["", "text", "txt", "plain", "plaintext"]);
let highlighter: Promise<HighlighterCore> | undefined;
/** Requested (normalized) name → canonical Shiki language name, or `undefined` if unavailable. */
const languages = new Map<string, Promise<string | undefined>>();
const warned = new Set<string>();

/**
 * The page-wide highlighter, created on first use. Uses the pure-JS regex
 * engine, so no WASM is fetched and no bundler setup is needed.
 */
function getHighlighter(): Promise<HighlighterCore> {
  return (highlighter ??= createHighlighterCore({
    themes: [cssVariablesTheme],
    langs: [],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  }));
}

/** Lower-cases and trims a `language` attribute value. */
export function normalizeLanguage(language: string | null | undefined): string {
  return (language ?? "").trim().toLowerCase();
}

/**
 * Loads `language` (id or alias) into the shared highlighter once per page.
 *
 * @returns The canonical language name, or `undefined` when the language is
 * plain text, unknown, or failed to load.
 */
export function loadLanguage(language: string): Promise<string | undefined> {
  const name = normalizeLanguage(language);

  if (PLAIN_LANGUAGES.has(name)) return Promise.resolve(undefined);

  let pending = languages.get(name);

  if (!pending) {
    pending = loadLanguageUncached(name);
    languages.set(name, pending);
  }

  return pending;
}

async function loadLanguageUncached(name: string): Promise<string | undefined> {
  try {
    const registrations = await getLanguageLoader()(name);

    if (registrations?.length) {
      const instance = await getHighlighter();

      await instance.loadLanguage(...registrations);

      return registrations[registrations.length - 1].name;
    }
  } catch {
    /* network/CDN failure or broken grammar — fall through to plain text */
  }

  warnOnce(name);

  return undefined;
}

/**
 * Tokenizes `code` as `language`.
 *
 * @returns One token array per line, or `undefined` when the code should be
 * rendered as plain text.
 */
export async function tokenize(code: string, language: string): Promise<ThemedToken[][] | undefined> {
  const lang = await loadLanguage(language);

  if (!lang) return undefined;

  const instance = await getHighlighter();

  return instance.codeToTokens(code, { lang, theme: CODE_THEME_NAME }).tokens;
}

function warnOnce(name: string): void {
  if (warned.has(name)) return;

  warned.add(name);
  console.warn(`[tp-code] Unknown or unavailable language "${name}"; rendering as plain text.`);
}
