import { describe, expect, it } from "vitest";

import { formatDate, resolveFormat } from "./format";
import { formatPattern } from "./format-pattern";

const date = new Date("2024-01-22T11:05:09.042Z");
const UTC = "UTC";

describe("formatPattern", () => {
  it("formats numeric tokens", () => {
    expect(formatPattern(date, "YYYY-MM-DD HH:mm:ss.SSS", "en", UTC)).toBe("2024-01-22 11:05:09.042");
    expect(formatPattern(date, "YY M D H m s", "en", UTC)).toBe("24 1 22 11 5 9");
  });

  it("formats 12-hour clocks and day periods", () => {
    const evening = new Date("2024-01-22T21:05:00Z");

    expect(formatPattern(evening, "h:mm A", "en", UTC)).toBe("9:05 PM");
    expect(formatPattern(evening, "hh a", "en", UTC)).toBe("09 pm");
    expect(formatPattern(new Date("2024-01-22T00:00:00Z"), "h A", "en", UTC)).toBe("12 AM");
  });

  it("localizes month and weekday names", () => {
    expect(formatPattern(date, "dddd, D MMMM YYYY", "en", UTC)).toBe("Monday, 22 January 2024");
    expect(formatPattern(date, "ddd D MMM", "en", UTC)).toBe("Mon 22 Jan");
    expect(formatPattern(date, "D MMMM YYYY dddd", "tr", UTC)).toBe("22 Ocak 2024 Pazartesi");
  });

  it("renders in the given time zone with offsets", () => {
    expect(formatPattern(date, "HH:mm Z", "en", "Europe/Istanbul")).toBe("14:05 +03:00");
    expect(formatPattern(date, "HH:mm ZZ", "en", "Asia/Kolkata")).toBe("16:35 +0530");
  });

  it("formats unix timestamps and bracketed literals", () => {
    expect(formatPattern(date, "X|x", "en", UTC)).toBe(`${Math.floor(date.getTime() / 1000)}|${date.getTime()}`);
    expect(formatPattern(date, "[Year] YYYY", "en", UTC)).toBe("Year 2024");
  });
});

describe("resolveFormat", () => {
  it("defaults to the medium preset", () => {
    expect(resolveFormat("")).toEqual({ kind: "preset", dateStyle: "medium", timeStyle: "medium" });
  });

  it("recognizes presets and relative", () => {
    expect(resolveFormat("short")).toEqual({ kind: "preset", dateStyle: "short", timeStyle: "short" });
    expect(resolveFormat(" relative ")).toEqual({ kind: "relative" });
  });

  it("applies date/time style overrides", () => {
    expect(resolveFormat("long", "none")).toEqual({ kind: "preset", dateStyle: undefined, timeStyle: "long" });
    expect(resolveFormat("", "full", "none")).toEqual({ kind: "preset", dateStyle: "full", timeStyle: undefined });
    expect(resolveFormat("", "none", "none")).toEqual({ kind: "preset", dateStyle: "medium" });
  });

  it("treats anything else as a pattern", () => {
    expect(resolveFormat("DD/MM/YYYY")).toEqual({ kind: "pattern", pattern: "DD/MM/YYYY" });
  });
});

describe("formatDate", () => {
  it("formats presets with Intl", () => {
    const spec = resolveFormat("", "medium", "none");

    expect(formatDate(date, spec, { locale: "en-US", timeZone: UTC, now: 0 })).toBe("Jan 22, 2024");
  });

  it("formats relative dates", () => {
    expect(formatDate(date, { kind: "relative" }, { locale: "en", now: date.getTime() + 3 * 60_000 })).toBe(
      "3 minutes ago",
    );
  });
});
