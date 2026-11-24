/**
 * Render state of `<tp-mermaid>`, reflected as its `status` attribute.
 *
 * - `pending`: Mermaid is loading or the diagram is being laid out.
 * - `rendered`: the SVG is shown.
 * - `error`: the source could not be parsed or rendered; the source and the
 *   error message are shown instead.
 */
export type MermaidStatus = "pending" | "rendered" | "error";

/** `detail` of the `tp-mermaid-render` event. */
export interface MermaidRenderEventDetail {
  /** The diagram type Mermaid detected (`flowchart-v2`, `sequence`, …), when it rendered. */
  diagramType?: string;
  /** The error message, when it failed. */
  error?: string;
}
