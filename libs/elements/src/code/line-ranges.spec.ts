import { describe, expect, it } from "vitest";

import { isLineInRanges, parseLineRanges } from "./line-ranges";

describe("parseLineRanges", () => {
  it("returns no ranges for empty input", () => {
    expect(parseLineRanges("")).toEqual([]);
    expect(parseLineRanges(null)).toEqual([]);
    expect(parseLineRanges(undefined)).toEqual([]);
  });

  it("parses single lines and ranges", () => {
    expect(parseLineRanges("2, 4-6,10")).toEqual([
      [2, 2],
      [4, 6],
      [10, 10],
    ]);
  });

  it("normalizes reversed ranges", () => {
    expect(parseLineRanges("6-4")).toEqual([[4, 6]]);
  });

  it("tolerates whitespace around dashes", () => {
    expect(parseLineRanges(" 3 - 5 ")).toEqual([[3, 5]]);
  });

  it("ignores malformed parts", () => {
    expect(parseLineRanges("a, 2, -3, 4-, 5-6-7, 8")).toEqual([
      [2, 2],
      [8, 8],
    ]);
  });
});

describe("isLineInRanges", () => {
  const ranges = parseLineRanges("2, 4-6");

  it.each([
    [1, false],
    [2, true],
    [3, false],
    [4, true],
    [5, true],
    [6, true],
    [7, false],
  ])("line %i → %s", (line, expected) => {
    expect(isLineInRanges(ranges, line)).toBe(expected);
  });
});
