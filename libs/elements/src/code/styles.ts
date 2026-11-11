import { css } from "lit";

/**
 * Resolves every public `--tp-code-*` variable into a private `--_tp-code-*`
 * one on `:host`. Shiki's CSS-variables theme emits `var(--_tp-code-…)` for
 * token colors (see `css-variables-theme.ts`), so the public variables can be
 * set on `tp-code` or on any ancestor. Fallbacks derive from the shared
 * `--tp-color-*` palette and mix with the foreground so they stay readable on
 * light and dark surfaces alike.
 */
const variables = css`
  :host {
    --_tp-code-foreground: var(--tp-code-foreground, var(--tp-color-contrast, hsl(0 0% 12%)));
    --_tp-code-background: var(--tp-code-background, color-mix(in oklab, var(--_tp-code-foreground) 6%, transparent));
    --_tp-code-accent-strength: var(--tp-code-accent-strength, 80%);

    --_tp-code-primary: var(--tp-color-primary, hsl(220 90% 56%));
    --_tp-code-secondary: var(--tp-color-secondary, hsl(340 82% 52%));
    --_tp-code-success: var(--tp-color-success, hsl(140 70% 40%));
    --_tp-code-danger: var(--tp-color-danger, hsl(0 70% 50%));
    --_tp-code-warning: var(--tp-color-warning, hsl(45 100% 50%));

    --_tp-code-token-keyword: var(--tp-code-token-keyword, color-mix(in oklab, var(--_tp-code-secondary) var(--_tp-code-accent-strength), var(--_tp-code-foreground)));
    --_tp-code-token-function: var(--tp-code-token-function, color-mix(in oklab, var(--_tp-code-primary) var(--_tp-code-accent-strength), var(--_tp-code-foreground)));
    --_tp-code-token-constant: var(--tp-code-token-constant, color-mix(in oklab, color-mix(in oklab, var(--_tp-code-primary), var(--_tp-code-secondary)) var(--_tp-code-accent-strength), var(--_tp-code-foreground)));
    --_tp-code-token-string: var(--tp-code-token-string, color-mix(in oklab, var(--_tp-code-success) var(--_tp-code-accent-strength), var(--_tp-code-foreground)));
    --_tp-code-token-string-expression: var(--tp-code-token-string-expression, color-mix(in oklab, var(--_tp-code-success) 60%, var(--_tp-code-foreground)));
    --_tp-code-token-parameter: var(--tp-code-token-parameter, color-mix(in oklab, var(--_tp-code-warning) 55%, var(--_tp-code-foreground)));
    --_tp-code-token-comment: var(--tp-code-token-comment, color-mix(in oklab, var(--_tp-code-foreground) 55%, transparent));
    --_tp-code-token-punctuation: var(--tp-code-token-punctuation, color-mix(in oklab, var(--_tp-code-foreground) 75%, transparent));
    --_tp-code-token-link: var(--tp-code-token-link, var(--_tp-code-token-function));
    --_tp-code-token-inserted: var(--tp-code-token-inserted, var(--_tp-code-token-string));
    --_tp-code-token-deleted: var(--tp-code-token-deleted, color-mix(in oklab, var(--_tp-code-danger) var(--_tp-code-accent-strength), var(--_tp-code-foreground)));
    --_tp-code-token-changed: var(--tp-code-token-changed, var(--_tp-code-token-parameter));

    --_tp-code-ansi-black: var(--tp-code-ansi-black, hsl(0 0% 20%));
    --_tp-code-ansi-red: var(--tp-code-ansi-red, var(--_tp-code-danger));
    --_tp-code-ansi-green: var(--tp-code-ansi-green, var(--_tp-code-success));
    --_tp-code-ansi-yellow: var(--tp-code-ansi-yellow, var(--_tp-code-warning));
    --_tp-code-ansi-blue: var(--tp-code-ansi-blue, var(--_tp-code-primary));
    --_tp-code-ansi-magenta: var(--tp-code-ansi-magenta, var(--_tp-code-secondary));
    --_tp-code-ansi-cyan: var(--tp-code-ansi-cyan, hsl(185 70% 40%));
    --_tp-code-ansi-white: var(--tp-code-ansi-white, hsl(0 0% 85%));
    --_tp-code-ansi-bright-black: var(--tp-code-ansi-bright-black, hsl(0 0% 45%));
    --_tp-code-ansi-bright-red: var(--tp-code-ansi-bright-red, color-mix(in oklab, var(--_tp-code-ansi-red) 70%, white));
    --_tp-code-ansi-bright-green: var(--tp-code-ansi-bright-green, color-mix(in oklab, var(--_tp-code-ansi-green) 70%, white));
    --_tp-code-ansi-bright-yellow: var(--tp-code-ansi-bright-yellow, color-mix(in oklab, var(--_tp-code-ansi-yellow) 70%, white));
    --_tp-code-ansi-bright-blue: var(--tp-code-ansi-bright-blue, color-mix(in oklab, var(--_tp-code-ansi-blue) 70%, white));
    --_tp-code-ansi-bright-magenta: var(--tp-code-ansi-bright-magenta, color-mix(in oklab, var(--_tp-code-ansi-magenta) 70%, white));
    --_tp-code-ansi-bright-cyan: var(--tp-code-ansi-bright-cyan, color-mix(in oklab, var(--_tp-code-ansi-cyan) 70%, white));
    --_tp-code-ansi-bright-white: var(--tp-code-ansi-bright-white, white);

    --_tp-code-line-number-color: var(--tp-code-line-number-color, color-mix(in oklab, var(--_tp-code-foreground) 40%, transparent));
    --_tp-code-line-highlight-background: var(--tp-code-line-highlight-background, color-mix(in oklab, var(--_tp-code-primary) 14%, transparent));
    --_tp-code-line-highlight-border-color: var(--tp-code-line-highlight-border-color, var(--_tp-code-primary));
  }
`;
const layout = css`
  :host {
    display: inline;
    color: var(--_tp-code-foreground);
    font-family: var(--tp-code-font-family, ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace);
    font-size: var(--tp-code-font-size, 0.875em);
  }

  :host([variant="block"]) {
    display: block;
    position: relative;
  }

  :host([hidden]) {
    display: none;
  }

  code {
    font: inherit;
  }

  .inline {
    padding: var(--tp-code-inline-padding, 0.1em 0.35em);
    border-radius: var(--tp-code-radius, 0.3em);
    background: var(--_tp-code-background);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
  }

  .block {
    margin: 0;
    padding-block: var(--tp-code-padding-block, 1em);
    border-radius: var(--tp-code-radius, 0.5em);
    background: var(--_tp-code-background);
    overflow: auto;
    /* The font shorthand comes first: it would otherwise reset line-height. */
    font: inherit;
    line-height: var(--tp-code-line-height, 1.6);
    tab-size: var(--tp-code-tab-size, 2);
  }

  /* Grid + max-content: every line is as wide as the longest one, so line
     highlights span the full scroll width. */
  .block code {
    display: grid;
    min-width: max-content;
  }

  .line {
    display: block;
    min-block-size: 1lh;
    padding-inline: var(--tp-code-padding-inline, 1em);
    white-space: pre;
  }

  /* Line numbers come from a CSS counter on ::before, so they never end up in
     selected/copied text. */
  .numbered .line {
    counter-increment: tp-code-line;
  }

  .numbered .line::before {
    content: counter(tp-code-line);
    display: inline-block;
    min-inline-size: var(--_tp-code-gutter, 2ch);
    margin-inline-end: var(--tp-code-line-number-gap, 1.5em);
    color: var(--_tp-code-line-number-color);
    text-align: end;
    user-select: none;
  }

  .line[data-highlighted] {
    background: var(--_tp-code-line-highlight-background);
    box-shadow: inset 3px 0 0 var(--_tp-code-line-highlight-border-color);
  }
`;
const copyButton = css`
  .copy {
    position: absolute;
    inset-block-start: 0.5em;
    inset-inline-end: 0.5em;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 2.25em;
    block-size: 2.25em;
    padding: 0;
    border: 1px solid color-mix(in oklab, var(--_tp-code-foreground) 18%, transparent);
    border-radius: 0.4em;
    background: var(--tp-code-copy-background, Canvas);
    color: var(--tp-code-copy-color, var(--_tp-code-foreground));
    font: inherit;
    cursor: pointer;
    opacity: 0;
    transition: opacity 120ms ease;
  }

  :host(:hover) .copy,
  .copy:focus-visible,
  .copy[data-copied] {
    opacity: 1;
  }

  @media (hover: none) {
    .copy {
      opacity: 1;
    }
  }

  .copy[data-copied] {
    color: var(--tp-code-copy-success-color, var(--_tp-code-success));
  }

  .copy svg {
    inline-size: 1.15em;
    block-size: 1.15em;
  }
`;

export const codeStyles = [variables, layout, copyButton];
