import { LitElement, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import type { ThemedToken } from "shiki/core";

import { copyText } from "./copy";
import { tokenize } from "./highlighter";
import { parseLineRanges, type LineRanges } from "./line-ranges";
import { normalizeSource, readSource } from "./source";
import { codeStyles } from "./styles";
import { renderBlock, renderInline, type CodeLine } from "./templates";
import type { CodeCopyEventDetail, CodeHighlightEventDetail, CodeVariant } from "./types";

const COPIED_RESET_MS = 2000;

declare global {
  interface HTMLElementTagNameMap {
    /**
     * Syntax-highlighted code, inline or as a block. Highlighting is powered by
     * Shiki; every Shiki language loads lazily on first use.
     *
     * Source comes from the element's text content (or a `<template>` child, or
     * the `code` property). Variants: `inline` (default) and `block` (with
     * optional `line-numbers`, `highlight-lines`, and `copyable`). Colors are
     * entirely `--tp-code-*` CSS variables.
     *
     * @example
     * ```html
     * <p>Run <tp-code language="sh">pnpm install</tp-code> first.</p>
     *
     * <tp-code variant="block" language="ts" line-numbers highlight-lines="2" copyable>
     *   const answer = 42;
     *   console.log(answer);
     * </tp-code>
     * ```
     */
    "tp-code": CodeElement;
  }

  interface HTMLElementEventMap {
    "tp-code-highlight": CustomEvent<CodeHighlightEventDetail>;
    "tp-code-copy": CustomEvent<CodeCopyEventDetail>;
  }
}

/**
 * `<tp-code>` &mdash; syntax-highlighted code powered by [Shiki](https://shiki.style).
 *
 * - **Source**: the element's text content, a direct `<template>` child (for
 *   HTML samples, no escaping needed), or the `code` property. Light-DOM
 *   changes are observed and re-highlighted.
 * - **Languages**: any Shiki language id or alias via `language`, loaded lazily
 *   once per page. Unknown languages render as plain text.
 * - **Rendering**: into shadow DOM, so the light DOM stays the untouched
 *   source of truth; style through `--tp-code-*` variables and `::part()`.
 * - **Async**: plain text renders immediately and is swapped for highlighted
 *   tokens once the grammar loads &mdash; same line layout, no shift.
 *
 * @element tp-code
 *
 * @attr {"inline" | "block"} [variant="inline"] - Layout.
 * @attr {string} [language=""] - Shiki language id or alias (`ts`, `html`, `sh`, …). Empty, `text`, or unknown → plain text.
 * @attr {boolean} [line-numbers=false] - Block only. Shows line numbers.
 * @attr {number} [line-start=1] - Block only. Number of the first line.
 * @attr {string} [highlight-lines=""] - Block only. Lines to emphasize, e.g. `"2, 4-6"` (in displayed line numbers).
 * @attr {boolean} [copyable=false] - Block only. Shows a copy-to-clipboard button.
 *
 * @fires tp-code-highlight - After each highlight pass. `detail: { language, highlighted }`.
 * @fires tp-code-copy - After the copy button is used. `detail: { code, success }`.
 *
 * @csspart pre - Block wrapper (`<pre>`).
 * @csspart code - The `<code>` element (both variants).
 * @csspart line - Every line (block).
 * @csspart highlighted-line - Lines matched by `highlight-lines`.
 * @csspart copy-button - The copy button.
 *
 * @cssprop --tp-code-foreground - Text color. Defaults to `--tp-color-contrast`.
 * @cssprop --tp-code-background - Surface color. Defaults to a 6% tint of the foreground.
 * @cssprop --tp-code-font-family - Monospace font stack.
 * @cssprop --tp-code-font-size - Defaults to `0.875em`.
 * @cssprop --tp-code-line-height - Block line height. Defaults to `1.6`.
 * @cssprop --tp-code-tab-size - Defaults to `2`.
 * @cssprop --tp-code-radius - Corner radius (`0.3em` inline, `0.5em` block).
 * @cssprop --tp-code-inline-padding - Inline padding. Defaults to `0.1em 0.35em`.
 * @cssprop --tp-code-padding-block - Block vertical padding. Defaults to `1em`.
 * @cssprop --tp-code-padding-inline - Block horizontal padding per line. Defaults to `1em`.
 * @cssprop --tp-code-accent-strength - How much of the palette color token defaults keep vs. the foreground. Defaults to `80%`.
 * @cssprop --tp-code-token-keyword - Keywords. Defaults from `--tp-color-secondary`.
 * @cssprop --tp-code-token-function - Functions. Defaults from `--tp-color-primary`.
 * @cssprop --tp-code-token-constant - Constants, numbers, variables.
 * @cssprop --tp-code-token-string - Strings. Defaults from `--tp-color-success`.
 * @cssprop --tp-code-token-string-expression - Template/string expressions.
 * @cssprop --tp-code-token-parameter - Parameters. Defaults from `--tp-color-warning`.
 * @cssprop --tp-code-token-comment - Comments.
 * @cssprop --tp-code-token-punctuation - Punctuation.
 * @cssprop --tp-code-token-link - Links.
 * @cssprop --tp-code-token-inserted - Diff insertions.
 * @cssprop --tp-code-token-deleted - Diff deletions. Defaults from `--tp-color-danger`.
 * @cssprop --tp-code-token-changed - Diff changes.
 * @cssprop --tp-code-ansi-black - ANSI colors (also `-red`, `-green`, `-yellow`, `-blue`, `-magenta`, `-cyan`, `-white` and their `-bright-*` variants) for `ansi` code.
 * @cssprop --tp-code-line-number-color - Line number color.
 * @cssprop --tp-code-line-number-gap - Space between line numbers and code. Defaults to `1.5em`.
 * @cssprop --tp-code-line-highlight-background - Highlighted line background. Defaults from `--tp-color-primary`.
 * @cssprop --tp-code-line-highlight-border-color - Highlighted line edge marker.
 * @cssprop --tp-code-copy-background - Copy button background. Defaults to `Canvas`.
 * @cssprop --tp-code-copy-color - Copy button icon color.
 * @cssprop --tp-code-copy-success-color - Copy button color after a successful copy.
 */
export class CodeElement extends LitElement {
  static override styles = codeStyles;

  /** Layout: `inline` (default) or `block`. */
  @property({ reflect: true })
  variant: CodeVariant = "inline";

  /** Shiki language id or alias. Empty/`text`/unknown renders plain text. */
  @property({ reflect: true })
  language = "";

  /** Block only. Shows line numbers. */
  @property({ type: Boolean, reflect: true, attribute: "line-numbers" })
  lineNumbers = false;

  /** Block only. Number of the first line. */
  @property({ type: Number, attribute: "line-start" })
  lineStart = 1;

  /** Block only. Lines to emphasize, e.g. `"2, 4-6"`. */
  @property({ attribute: "highlight-lines" })
  highlightLines = "";

  /** Block only. Shows a copy-to-clipboard button. */
  @property({ type: Boolean, reflect: true })
  copyable = false;

  /**
   * Source code. When set, it overrides the light-DOM content; set it back to
   * `undefined` to fall back to the children again.
   */
  @property({ attribute: false })
  code?: string;

  /** Raw source read from `code` or the light DOM. */
  @state()
  private rawSource = "";

  @state()
  private tokens?: ThemedToken[][];

  @state()
  private copied = false;

  #source = "";
  #ranges: LineRanges = [];
  #observer?: MutationObserver;
  #request = 0;
  #highlightDone: Promise<void> = Promise.resolve();
  #copiedTimer?: ReturnType<typeof setTimeout>;

  /** The normalized source being displayed (dedented for blocks, trimmed inline). */
  get source(): string {
    return this.#source;
  }

  /** Resolves once the current highlight pass (if any) has rendered. */
  get highlightComplete(): Promise<void> {
    return this.#highlightDone;
  }

  override connectedCallback(): void {
    super.connectedCallback();

    this.#observer ??= new MutationObserver(() => this.#syncSource());
    this.#observer.observe(this, { childList: true, characterData: true, subtree: true });
    this.#syncSource();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#observer?.disconnect();
    clearTimeout(this.#copiedTimer);
    this.copied = false;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("code")) this.#syncSource();

    if (changed.has("highlightLines")) this.#ranges = parseLineRanges(this.highlightLines);

    if (changed.has("rawSource" as keyof CodeElement) || changed.has("variant")) {
      const source = normalizeSource(this.rawSource, this.variant);

      if (source !== this.#source) {
        this.#source = source;
        this.#highlight();

        return;
      }
    }

    if (changed.has("language")) this.#highlight();
  }

  protected override render(): unknown {
    const lines: CodeLine[] = this.tokens ?? this.#source.split("\n");

    if (this.variant !== "block") return renderInline(lines);

    return renderBlock({
      lines,
      lineNumbers: this.lineNumbers,
      lineStart: Number.isFinite(this.lineStart) ? Math.trunc(this.lineStart) : 1,
      highlightedLines: this.#ranges,
      copyable: this.copyable,
      copied: this.copied,
      onCopy: () => void this.copy(),
    });
  }

  /**
   * Copies the displayed source to the clipboard and fires `tp-code-copy`.
   *
   * @returns Whether the copy succeeded.
   */
  async copy(): Promise<boolean> {
    const code = this.#source;
    const success = await copyText(code);

    clearTimeout(this.#copiedTimer);
    this.copied = success;

    if (success) this.#copiedTimer = setTimeout(() => (this.copied = false), COPIED_RESET_MS);

    this.dispatchEvent(
      new CustomEvent<CodeCopyEventDetail>("tp-code-copy", {
        bubbles: true,
        composed: true,
        detail: { code, success },
      }),
    );

    return success;
  }

  #syncSource(): void {
    this.rawSource = this.code ?? readSource(this);
  }

  /** Starts a highlight pass; results from superseded passes are dropped. */
  #highlight(): void {
    const request = ++this.#request;
    const source = this.#source;
    const language = this.language;

    // Plain text renders right away; tokens replace it when ready.
    this.tokens = undefined;

    this.#highlightDone = tokenize(source, language).then(async tokens => {
      if (request !== this.#request) return;

      this.tokens = tokens;
      await this.updateComplete;

      this.dispatchEvent(
        new CustomEvent<CodeHighlightEventDetail>("tp-code-highlight", {
          bubbles: true,
          composed: true,
          detail: { language, highlighted: !!tokens },
        }),
      );
    });
  }
}
