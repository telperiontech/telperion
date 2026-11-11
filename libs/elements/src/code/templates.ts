import { html, nothing, svg, type TemplateResult } from "lit";
import { join } from "lit/directives/join.js";
import type { ThemedToken } from "shiki/core";

import { isLineInRanges, type LineRanges } from "./line-ranges";

/** A rendered line: highlighted tokens, or plain text while/if not highlighted. */
export type CodeLine = readonly ThemedToken[] | string;

const enum FontStyle {
  Italic = 1,
  Bold = 2,
  Underline = 4,
  Strikethrough = 8,
}

function tokenStyle(token: ThemedToken): string {
  const style = token.color ? [`color:${token.color}`] : [];
  const flags = token.fontStyle ?? 0;

  if (flags > 0) {
    if (flags & FontStyle.Italic) style.push("font-style:italic");

    if (flags & FontStyle.Bold) style.push("font-weight:bold");

    const decorations = [
      flags & FontStyle.Underline ? "underline" : "",
      flags & FontStyle.Strikethrough ? "line-through" : "",
    ].filter(Boolean);

    if (decorations.length) style.push(`text-decoration:${decorations.join(" ")}`);
  }

  return style.join(";");
}

function renderLineContent(line: CodeLine): unknown {
  if (typeof line === "string") return line;

  return line.map(token => html`<span style=${tokenStyle(token)}>${token.content}</span>`);
}

/** `variant="inline"`: a single `<code>`; lines are re-joined with `\n`. */
export function renderInline(lines: readonly CodeLine[]): TemplateResult {
  return html`<code part="code" class="inline">${join(lines.map(renderLineContent), "\n")}</code>`;
}

export interface BlockOptions {
  lines: readonly CodeLine[];
  lineNumbers: boolean;
  lineStart: number;
  highlightedLines: LineRanges;
  copyable: boolean;
  copied: boolean;
  onCopy: () => void;
}

/** `variant="block"`: `<pre><code>` with one block-level `.line` per source line. */
export function renderBlock(options: BlockOptions): TemplateResult {
  const { lines, lineNumbers, lineStart, highlightedLines } = options;
  const lastLine = lineStart + lines.length - 1;
  const gutter = Math.max(String(lineStart).length, String(lastLine).length);
  const codeStyle = `counter-reset:tp-code-line ${lineStart - 1};--_tp-code-gutter:${gutter}ch`;
  // Whitespace inside <pre> is significant: keep these templates on one line.
  const rendered = lines.map((line, index) => {
    const highlighted = isLineInRanges(highlightedLines, lineStart + index);

    return html`<span part=${highlighted ? "line highlighted-line" : "line"} class="line" ?data-highlighted=${highlighted}>${renderLineContent(line)}</span>`;
  });

  return html`<pre part="pre" class=${lineNumbers ? "block numbered" : "block"}><code part="code" style=${codeStyle}>${rendered}</code></pre>${options.copyable ? renderCopyButton(options.copied, options.onCopy) : nothing}`;
}

const copyIcon = svg`<path d="M9 9h10v10H9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M5 15V5h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
const checkIcon = svg`<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;

function renderCopyButton(copied: boolean, onCopy: () => void): TemplateResult {
  return html`
    <button
      part="copy-button"
      class="copy"
      type="button"
      aria-label=${copied ? "Copied" : "Copy code"}
      title=${copied ? "Copied" : "Copy code"}
      ?data-copied=${copied}
      @click=${onCopy}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">${copied ? checkIcon : copyIcon}</svg>
    </button>
  `;
}
