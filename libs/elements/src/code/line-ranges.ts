/** Inclusive `[start, end]` line ranges. */
export type LineRanges = readonly (readonly [number, number])[];

/**
 * Parses a `highlight-lines` value such as `"2, 4-6, 10"` into inclusive
 * ranges. Reversed ranges (`"6-4"`) are normalized; malformed parts are ignored.
 */
export function parseLineRanges(input: string | null | undefined): LineRanges {
  if (!input) return [];

  const ranges: [number, number][] = [];

  for (const part of input.split(",")) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);

    if (!match) continue;

    const a = Number(match[1]);
    const b = match[2] === undefined ? a : Number(match[2]);

    ranges.push([Math.min(a, b), Math.max(a, b)]);
  }

  return ranges;
}

/** Whether `line` falls inside any of `ranges`. */
export function isLineInRanges(ranges: LineRanges, line: number): boolean {
  return ranges.some(([start, end]) => line >= start && line <= end);
}
