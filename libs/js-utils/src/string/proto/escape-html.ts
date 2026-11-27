import type { Tail } from '@telperion/extra-ts-types';

import { escapeHtml } from '@telperion/js-utils/string/escape-html';

type FuncType = typeof escapeHtml;
type FuncArgs = Parameters<FuncType>;
type FuncReturn = ReturnType<FuncType>;
type ProtoArgs = Tail<FuncArgs>;

declare global {
  export interface String {
    /**
     * #### Escape HTML
     *
     * Escapes `&`, `<`, `>`, `"` and `'` so the string can be put into HTML as text content or as a quoted attribute value.
     * Not enough for unquoted attributes, URLs (`javascript:`), `<script>` or `<style>` content.
     *
     * * * *
     * Example:
     * ```typescript
     * import "@telperion/js-utils/string/proto/escape-html";
     *
     * '<b>bold</b>'.escapeHtml(); // '&lt;b&gt;bold&lt;/b&gt;'
     * ```
     * * * *
     * @return The string with `&`, `<`, `>`, `"` and `'` replaced by character references
     */
    escapeHtml(...args: ProtoArgs): FuncReturn;
  }
}

String.prototype.escapeHtml = function (this: string, ...args: ProtoArgs): FuncReturn {
  return escapeHtml(this, ...args);
};
