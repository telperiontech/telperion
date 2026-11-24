import { cdnMermaidLoader } from "./cdn-mermaid-loader";
import { setMermaidLoader } from "./loader";
import { MermaidElement } from "./mermaid-element-base";

/**
 * CDN entry for `<tp-mermaid>` (used by the self-contained IIFE build): Mermaid
 * is imported at runtime from jsDelivr instead of being bundled, since an IIFE
 * cannot code-split. Point it elsewhere with `setMermaidCdnUrl()`.
 */
setMermaidLoader(cdnMermaidLoader);

if (!customElements.get("tp-mermaid")) customElements.define("tp-mermaid", MermaidElement);

export { MermaidElement };
export { setMermaidCdnUrl, mermaidCdnUrl, MERMAID_VERSION } from "./cdn-mermaid-loader";
export { setMermaidLoader, type MermaidLoader } from "./loader";
export type { MermaidStatus, MermaidRenderEventDetail } from "./types";
