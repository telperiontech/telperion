import type { CodeVariant } from "./types";

/**
 * Reads the raw source of a `<tp-code>` host from its light DOM.
 *
 * - A direct `<template>` child wins: its serialized `innerHTML` is used, so
 *   authors can embed HTML samples without escaping `<` / `&`.
 * - Otherwise the host's `textContent` is used.
 */
export function readSource(host: Element): string {
  const template = host.querySelector(":scope > template");

  if (template) return template.innerHTML;

  return host.textContent ?? "";
}

/**
 * Normalizes raw source for display.
 *
 * - Line endings become `\n`.
 * - `inline`: surrounding whitespace is trimmed.
 * - `block`: leading/trailing blank lines are removed and the common
 *   indentation is stripped (see {@link dedent}).
 */
export function normalizeSource(raw: string, variant: CodeVariant): string {
  const source = raw.replace(/\r\n?/g, "\n");

  return variant === "block" ? dedent(source) : source.trim();
}

/**
 * Removes leading/trailing blank lines and the indentation shared by every
 * non-blank line. Tabs and spaces both count as one indentation character.
 */
export function dedent(source: string): string {
  const lines = source.split("\n");

  while (lines.length && isBlank(lines[0])) lines.shift();

  while (lines.length && isBlank(lines[lines.length - 1])) lines.pop();

  const indent = lines
    .filter(line => !isBlank(line))
    .reduce((min, line) => Math.min(min, line.match(/^[ \t]*/)![0].length), Infinity);

  if (!Number.isFinite(indent) || indent === 0) return lines.join("\n");

  return lines.map(line => line.slice(Math.min(indent, line.length))).join("\n");
}

function isBlank(line: string): boolean {
  return line.trim() === "";
}
