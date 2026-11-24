import type { MermaidConfig, RenderResult } from "mermaid";

import { loadMermaid } from "./loader";

/** Settings every diagram gets; a diagram's own config can change anything but these. */
const BASE_CONFIG: MermaidConfig = {
  startOnLoad: false,
  securityLevel: "strict",
  // The element shows its own error state; Mermaid's error SVG would be left in <body>
  suppressErrorRendering: true,
};
let queue: Promise<unknown> = Promise.resolve();
let counter = 0;

/**
 * Renders `source` to SVG with `config` (the host's theme).
 *
 * Mermaid's config is global, so renders run one at a time and each one
 * applies its own config first; otherwise two diagrams with different themes
 * could swap colors.
 */
export function renderDiagram(source: string, config: MermaidConfig): Promise<RenderResult> {
  const run = async () => {
    const mermaid = await loadMermaid();

    mermaid.initialize({ ...config, ...BASE_CONFIG });

    return mermaid.render(`tp-mermaid-${++counter}`, source);
  };
  const result = queue.then(run, run);

  queue = result.catch(() => undefined);

  return result;
}

/** A readable message from whatever Mermaid threw. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === "string") return error;

  return String((error as { message?: unknown } | null)?.message ?? error);
}
