const ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/**
 * #### Escape HTML
 *
 * Escapes `&`, `<`, `>`, `"` and `'` so a string can be put into HTML as text content or as a quoted attribute value
 *
 * Every `&` is escaped, including the one of an existing entity, so `&amp;` becomes `&amp;amp;`:
 * escape raw values once, right where they are put into the HTML.
 *
 * Not enough on its own for:
 * - unquoted attribute values (`<a title=${value}>`): always quote attributes
 * - URLs (`href`, `src`): `javascript:` URLs contain none of the escaped characters, so check the scheme or use a safe-path check
 * - `<script>` and `<style>` content, and event handler attributes (`onclick`), which are parsed as JS or CSS, not HTML
 *
 * * * *
 * Example:
 * ```typescript
 * import { escapeHtml } from "@telperion/js-utils/string";
 *
 * escapeHtml('<b>"Tom" & \'Jerry\'</b>'); // '&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;'
 *
 * const page = `<p title="${escapeHtml(title)}">${escapeHtml(message)}</p>`;
 * ```
 *
 * Prototype Example:
 * ```typescript
 * import "@telperion/js-utils/string/proto/escape-html";
 *
 * '<b>bold</b>'.escapeHtml(); // '&lt;b&gt;bold&lt;/b&gt;'
 * ```
 * * * *
 * @param value Text to escape
 * @return The text with `&`, `<`, `>`, `"` and `'` replaced by character references
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ESCAPES[char]);
}
