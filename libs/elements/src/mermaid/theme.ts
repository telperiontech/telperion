import type { MermaidConfig } from "mermaid";

/** Private `--_tp-mermaid-*` variable (see `styles.ts`) → Mermaid theme variables it feeds. */
const COLOR_VARIABLES: Record<string, readonly string[]> = {
  foreground: ["primaryTextColor", "secondaryTextColor", "tertiaryTextColor", "textColor", "titleColor", "nodeTextColor", "actorTextColor", "signalTextColor", "labelTextColor", "noteTextColor"],
  background: ["background", "edgeLabelBackground"],
  "node-background": ["primaryColor", "mainBkg", "actorBkg", "labelBoxBkgColor"],
  "node-border": ["primaryBorderColor", "nodeBorder", "actorBorder", "labelBoxBorderColor", "noteBorderColor"],
  line: ["lineColor", "signalColor", "actorLineColor"],
  "cluster-background": ["secondaryColor", "tertiaryColor", "clusterBkg"],
  "cluster-border": ["secondaryBorderColor", "tertiaryBorderColor", "clusterBorder"],
  "note-background": ["noteBkgColor"],
};
let context: CanvasRenderingContext2D | null | undefined;

/**
 * Converts any CSS color (`color-mix()`, `oklch()`, …) to `rgba()`, which
 * Mermaid's color math understands, by painting it on a 1×1 canvas. Falls back
 * to the value as written where canvas is unavailable.
 */
export function toRgba(color: string): string {
  context ??= createContext();

  if (!context || !color) return color;

  context.clearRect(0, 0, 1, 1);
  context.fillStyle = "#000";
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);

  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;

  return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`;
}

function createContext(): CanvasRenderingContext2D | null {
  try {
    const canvas = document.createElement("canvas");

    canvas.width = canvas.height = 1;

    return canvas.getContext("2d", { willReadFrequently: true });
  } catch {
    return null;
  }
}

/** Relative luminance (0–1) of an `rgba()` color, or `undefined` if it is not one. */
function luminance(color: string): number | undefined {
  const channels = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)?.slice(1).map(Number);

  if (!channels) return undefined;

  const [r, g, b] = channels.map(channel => {
    const value = channel / 255;

    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The Mermaid config for `host`: the `base` theme with every color taken from
 * the host's resolved `--tp-mermaid-*` variables, and its font.
 */
export function themeConfig(host: Element): MermaidConfig {
  const style = getComputedStyle(host);
  const themeVariables: Record<string, string | boolean> = {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
  };

  for (const [name, targets] of Object.entries(COLOR_VARIABLES)) {
    const value = style.getPropertyValue(`--_tp-mermaid-${name}`).trim();

    if (!value) continue;

    const color = toRgba(value);

    for (const target of targets) themeVariables[target] = color;
  }

  const background = luminance(String(themeVariables["background"] ?? ""));

  if (background !== undefined) themeVariables["darkMode"] = background < 0.4;

  return { theme: "base", themeVariables, fontFamily: style.fontFamily };
}
