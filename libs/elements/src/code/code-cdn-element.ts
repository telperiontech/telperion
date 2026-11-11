import { cdnLanguageLoader } from "./cdn-language-loader";
import { CodeElement } from "./code-element-base";
import { setLanguageLoader } from "./language-loader";

/**
 * CDN entry for `<tp-code>` (used by the self-contained IIFE build): grammars
 * are imported at runtime from jsDelivr instead of being bundled, since an
 * IIFE cannot code-split. Point it elsewhere with `setLanguageCdnBaseUrl()`.
 */
setLanguageLoader(cdnLanguageLoader);

if (!customElements.get("tp-code")) customElements.define("tp-code", CodeElement);

export { CodeElement };
export { setLanguageCdnBaseUrl, languageCdnUrl, SHIKI_LANGS_VERSION } from "./cdn-language-loader";
export { setLanguageLoader, type LanguageLoader } from "./language-loader";
export type { CodeVariant, CodeCopyEventDetail, CodeHighlightEventDetail } from "./types";
