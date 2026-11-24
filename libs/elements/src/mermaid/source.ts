import { dedent } from "../code/source";

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&nbsp;": " " };

/**
 * Reads the raw diagram source of a `<tp-mermaid>` host from its light DOM.
 *
 * - A direct `<template>` child wins. Its markup is used with the entities the
 *   HTML serializer adds turned back into characters, so `A --> B` and
 *   `<br/>` labels can be written as they are.
 * - Otherwise the host's `textContent` is used (escape `<` there).
 */
export function readSource(host: Element): string {
  const template = host.querySelector(":scope > template");

  if (template) return template.innerHTML.replace(/&(?:amp|lt|gt|quot|nbsp);/g, entity => ENTITIES[entity]);

  return host.textContent ?? "";
}

/** Normalizes line endings and strips the shared indentation and surrounding blank lines. */
export function normalizeSource(raw: string): string {
  return dedent(raw.replace(/\r\n?/g, "\n"));
}
