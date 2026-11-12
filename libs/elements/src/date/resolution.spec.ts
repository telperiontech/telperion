import { describe, expect, it } from "vitest";

import { resolveFormat } from "./format";
import { PERIODS, tickPeriod } from "./resolution";

const now = Date.now();
const period = (format: string, dateStyle?: "none", timeStyle?: "short" | "none") =>
  tickPeriod(resolveFormat(format, dateStyle, timeStyle), new Date(now), now);

describe("tickPeriod", () => {
  it.each([
    ["DD/MM/YYYY", PERIODS.day],
    ["HH", PERIODS.hour],
    ["DD/MM/YYYY HH:mm", PERIODS.minute],
    ["HH:mm:ss", PERIODS.second],
    ["ss.SSS", PERIODS.millisecond],
    ["[ss]", PERIODS.day],
  ])("uses the finest token of %j", (format, expected) => {
    expect(period(format)).toBe(expected);
  });

  it("follows the time style of presets", () => {
    expect(period("medium")).toBe(PERIODS.second);
    expect(period("medium", undefined, "short")).toBe(PERIODS.minute);
    expect(period("long", undefined, "none")).toBe(PERIODS.day);
  });

  it("adapts relative dates to their distance", () => {
    expect(period("relative")).toBe(PERIODS.second);
  });
});
