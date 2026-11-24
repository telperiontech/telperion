import type { Mermaid } from "mermaid";

import type { MermaidLoader } from "./loader";

/**
 * Version of `mermaid` fetched from the CDN. Must match the installed
 * `mermaid` version (a spec enforces this).
 */
export const MERMAID_VERSION = "12.3.0";

const DEFAULT_URL = `https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.esm.min.mjs`;
let url = DEFAULT_URL;

/**
 * Points the CDN loader at another copy of `mermaid/dist/mermaid.esm.min.mjs`
 * (e.g. a self-hosted mirror). Pass nothing to restore the jsDelivr default.
 */
export function setMermaidCdnUrl(next: string = DEFAULT_URL): void {
  url = next;
}

/** The URL Mermaid is imported from. */
export function mermaidCdnUrl(): string {
  return url;
}

/**
 * Imports Mermaid at runtime from the CDN. Used by the self-contained IIFE
 * build, which cannot code-split Mermaid's diagram chunks.
 */
export const cdnMermaidLoader: MermaidLoader = async () => {
  const module: { default: Mermaid } = await import(/* @vite-ignore */ /* webpackIgnore: true */ url);

  return module.default;
};
