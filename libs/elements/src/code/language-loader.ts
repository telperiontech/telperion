import type { LanguageRegistration } from "shiki/core";

/**
 * Resolves a language id or alias (already trimmed and lower-cased) to the
 * Shiki grammar registrations it needs. The **last** registration is the
 * requested language itself; earlier ones are its embedded dependencies.
 *
 * Return `undefined` (or reject) for unknown languages &mdash; the element then
 * renders plain text.
 */
export type LanguageLoader = (name: string) => Promise<readonly LanguageRegistration[] | undefined>;

let loader: LanguageLoader = async () => undefined;

/**
 * Replaces the loader `<tp-code>` uses to fetch grammars.
 *
 * `@telperion/elements/code` installs a loader backed by Shiki's bundled,
 * lazily imported grammars; the CDN build (`code/cdn`) installs one that
 * imports grammars from jsDelivr. Call this before the first `<tp-code>`
 * highlights &mdash; languages that already loaded are cached.
 */
export function setLanguageLoader(next: LanguageLoader): void {
  loader = next;
}

/** The loader currently in use. */
export function getLanguageLoader(): LanguageLoader {
  return loader;
}
