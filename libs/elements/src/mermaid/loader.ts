import type { Mermaid } from "mermaid";

/**
 * Resolves the Mermaid API. Called once per page, on the first render.
 *
 * `@telperion/elements/mermaid` installs a loader that `import()`s the
 * `mermaid` package (bundlers split it into its own chunks); the CDN build
 * (`mermaid/cdn`) installs one that imports Mermaid from jsDelivr.
 */
export type MermaidLoader = () => Promise<Mermaid>;

let loader: MermaidLoader = () => Promise.reject(new Error("[tp-mermaid] No Mermaid loader installed."));
let loaded: Promise<Mermaid> | undefined;

/**
 * Replaces the loader `<tp-mermaid>` uses to fetch Mermaid. Call it before the
 * first diagram renders; once Mermaid has loaded it is cached for the page.
 */
export function setMermaidLoader(next: MermaidLoader): void {
  loader = next;
  loaded = undefined;
}

/** The loader currently in use. */
export function getMermaidLoader(): MermaidLoader {
  return loader;
}

/** Mermaid, loaded on first use. A failed load is retried on the next call. */
export function loadMermaid(): Promise<Mermaid> {
  return (loaded ??= loader().catch(error => {
    loaded = undefined;

    throw error;
  }));
}
