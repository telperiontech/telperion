import { describe, expect, it } from "vitest";

/**
 * Every `color-mix()` in the element sources must interpolate in OKLab.
 *
 * Mixing in a linear-light space such as `xyz` makes the shade scale
 * perceptually lopsided: `shade="700"` comes out barely darker than the base,
 * light shades wash out, and hover tints are too weak to notice. OKLab keeps
 * `shade` steps even and matches the Tailwind palettes of the consuming apps
 * (`--color-<name>-<shade>`), which use the same mix ratios in OKLab.
 */
const sources = import.meta.glob<string>(["../**/*.ts", "!../**/*.spec.ts", "!../**/*.stories.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
});
const mixes = Object.entries(sources).flatMap(([file, source]) =>
  [...source.matchAll(/color-mix\(\s*in\s+([\w-]+)/g)].map((match) => ({ file, space: match[1] })),
);

describe("color-mix interpolation space", () => {
  it("finds the element color mixes", () => {
    expect(mixes.length).toBeGreaterThan(0);
  });

  it("mixes every color in oklab", () => {
    expect(mixes.filter(({ space }) => space !== "oklab")).toEqual([]);
  });
});
