/**
 * Layout of `<tp-code>`.
 *
 * - `inline`: renders a single `<code>` that flows with surrounding text.
 * - `block`: renders a `<pre><code>` block with optional line numbers,
 *   highlighted lines, and a copy button.
 */
export type CodeVariant = "inline" | "block";

/** `detail` of the `tp-code-highlight` event. */
export interface CodeHighlightEventDetail {
  /** The `language` attribute as requested by the author. */
  language: string;
  /** `false` when the language was unknown/plain and the code rendered as plain text. */
  highlighted: boolean;
}

/** `detail` of the `tp-code-copy` event. */
export interface CodeCopyEventDetail {
  /** The (normalized) source that was copied. */
  code: string;
  /** Whether writing to the clipboard succeeded. */
  success: boolean;
}
