import type { LanguageRegistration } from "shiki/core";

import type { LanguageLoader } from "./language-loader";

/**
 * Version of `@shikijs/langs` fetched from the CDN. Must match the installed
 * `shiki` version (a spec enforces this).
 */
export const SHIKI_LANGS_VERSION = "4.6.0";

const DEFAULT_BASE_URL = `https://cdn.jsdelivr.net/npm/@shikijs/langs@${SHIKI_LANGS_VERSION}/dist/`;
/** Language ids/aliases are lowercase words with digits and dashes; anything else is rejected. */
const SAFE_NAME = /^[a-z0-9][a-z0-9-]*$/;
let baseUrl = DEFAULT_BASE_URL;

/**
 * Points the CDN loader at another host serving `@shikijs/langs/dist/*.mjs`
 * (e.g. a self-hosted mirror). Pass nothing to restore the jsDelivr default.
 */
export function setLanguageCdnBaseUrl(url: string = DEFAULT_BASE_URL): void {
  baseUrl = url.endsWith("/") ? url : `${url}/`;
}

/** The URL a language module is fetched from. */
export function languageCdnUrl(name: string): string {
  return `${baseUrl}${name}.mjs`;
}

/**
 * Imports grammars at runtime from the CDN. Used by the self-contained IIFE
 * build, which cannot code-split Shiki's bundled grammars. Every id and alias
 * has its own module in `@shikijs/langs`, and embedded languages are imported
 * relatively, so no alias table is needed here.
 */
export const cdnLanguageLoader: LanguageLoader = async name => {
  if (!SAFE_NAME.test(name)) return undefined;

  const module: { default: LanguageRegistration[] } = await import(
    /* @vite-ignore */ /* webpackIgnore: true */ languageCdnUrl(name)
  );

  return module.default;
};
