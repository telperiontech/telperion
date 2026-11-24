import type { MermaidLoader } from "./loader";

/** Imports the installed `mermaid` package lazily, so bundlers split it into its own chunks. */
export const bundledMermaidLoader: MermaidLoader = () => import("mermaid").then(module => module.default);
