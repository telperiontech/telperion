import { css } from "lit";

/**
 * Resolves every public `--tp-mermaid-*` color into a private `--_tp-mermaid-*`
 * one on `:host`, so the public variables can be set on `tp-mermaid` or any
 * ancestor. Mermaid bakes colors into the SVG, so `theme.ts` reads these
 * resolved values and passes them to Mermaid as theme variables. Fallbacks
 * derive from the shared `--tp-color-*` palette.
 */
const variables = css`
  :host {
    --_tp-mermaid-foreground: var(--tp-mermaid-foreground, var(--tp-color-contrast, hsl(0 0% 12%)));
    --_tp-mermaid-background: var(--tp-mermaid-background, var(--tp-color-white, white));
    --_tp-mermaid-accent: var(--tp-mermaid-accent, var(--tp-color-primary, hsl(220 90% 56%)));

    --_tp-mermaid-node-background: var(--tp-mermaid-node-background, color-mix(in oklab, var(--_tp-mermaid-accent) 10%, var(--_tp-mermaid-background)));
    --_tp-mermaid-node-border: var(--tp-mermaid-node-border, color-mix(in oklab, var(--_tp-mermaid-accent) 55%, var(--_tp-mermaid-background)));
    --_tp-mermaid-line: var(--tp-mermaid-line, color-mix(in oklab, var(--_tp-mermaid-foreground) 60%, var(--_tp-mermaid-background)));
    --_tp-mermaid-cluster-background: var(--tp-mermaid-cluster-background, color-mix(in oklab, var(--_tp-mermaid-foreground) 4%, var(--_tp-mermaid-background)));
    --_tp-mermaid-cluster-border: var(--tp-mermaid-cluster-border, color-mix(in oklab, var(--_tp-mermaid-foreground) 25%, var(--_tp-mermaid-background)));
    --_tp-mermaid-note-background: var(--tp-mermaid-note-background, color-mix(in oklab, var(--tp-color-warning, hsl(45 100% 50%)) 18%, var(--_tp-mermaid-background)));
  }
`;
const layout = css`
  :host {
    display: block;
    color: var(--_tp-mermaid-foreground);
    font-family: var(--tp-mermaid-font-family, inherit);
    font-size: var(--tp-mermaid-font-size, inherit);
  }

  :host([hidden]) {
    display: none;
  }

  .diagram {
    display: flex;
    justify-content: var(--tp-mermaid-align, center);
    overflow: auto;
  }

  .diagram svg {
    max-width: 100%;
    height: auto;
  }

  /* Mermaid's parse errors point at the column with a caret line: keep lines and alignment */
  .error {
    margin: 0 0 0.5em;
    color: var(--tp-color-danger, hsl(0 70% 50%));
    white-space: pre-wrap;
  }

  .error,
  .source {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 0.875em;
  }

  .source {
    margin: 0;
    padding: 1em;
    border-radius: 0.5em;
    background: color-mix(in oklab, var(--_tp-mermaid-foreground) 6%, transparent);
    overflow: auto;
  }
`;

export const mermaidStyles = [variables, layout];
