import { bundledMermaidLoader } from "./bundled-mermaid-loader";
import { setMermaidLoader } from "./loader";
import { MermaidElement } from "./mermaid-element-base";

/**
 * Bundler entry for `<tp-mermaid>`: Mermaid is `import()`ed on the first
 * render, so bundlers split it (and each diagram type) into lazy chunks.
 */
setMermaidLoader(bundledMermaidLoader);

if (!customElements.get("tp-mermaid")) customElements.define("tp-mermaid", MermaidElement);

export { MermaidElement };
