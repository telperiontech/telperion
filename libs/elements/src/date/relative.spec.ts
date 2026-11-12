import { describe, expect, it } from "vitest";

import { formatRelative, relativePeriod } from "./relative";

const now = Date.UTC(2024, 0, 22, 12);
const at = (offset: number) => new Date(now + offset);
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

describe("formatRelative", () => {
  it.each([
    [0, "now"],
    [-400, "now"],
    [-30_000, "30 seconds ago"],
    [-5 * MINUTE - 59_000, "5 minutes ago"],
    [2 * 60 * MINUTE, "in 2 hours"],
    [-DAY, "yesterday"],
    [3 * DAY, "in 3 days"],
    [-14 * DAY, "2 weeks ago"],
    [-60 * DAY, "2 months ago"],
    [800 * DAY, "in 2 years"],
  ])("formats %d ms as %j", (offset, expected) => {
    expect(formatRelative(at(offset), now, "en")).toBe(expected);
  });

  it("is localized", () => {
    expect(formatRelative(at(-3 * MINUTE), now, "tr")).toBe("3 dakika önce");
  });
});

describe("relativePeriod", () => {
  it("slows down as the date gets further away", () => {
    expect(relativePeriod(at(-30 * MINUTE), now)).toBe(1000);
    expect(relativePeriod(at(-3 * 60 * MINUTE), now)).toBe(MINUTE);
    expect(relativePeriod(at(-3 * DAY), now)).toBe(15 * MINUTE);
  });
});
