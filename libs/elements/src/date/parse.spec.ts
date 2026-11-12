import { describe, expect, it } from "vitest";

import { parseDate, type ParseOptions } from "./parse";

const now = Date.UTC(2024, 5, 15, 9, 0);
const utc: ParseOptions = { timeZone: "UTC", locale: "en-GB", now };
const iso = (input: Parameters<typeof parseDate>[0], options: Partial<ParseOptions> = {}) =>
  parseDate(input, { ...utc, ...options })?.toISOString();

describe("parseDate", () => {
  describe("empty and non-string input", () => {
    it.each([undefined, null, "", "   "])("returns undefined for %j", input => {
      expect(parseDate(input, utc)).toBeUndefined();
    });

    it("accepts Date and epoch numbers", () => {
      expect(iso(new Date(now))).toBe("2024-06-15T09:00:00.000Z");
      expect(iso(now)).toBe("2024-06-15T09:00:00.000Z");
      expect(iso(new Date(NaN))).toBeUndefined();
      expect(iso(Infinity)).toBeUndefined();
      expect(iso(9e15)).toBeUndefined();
    });
  });

  describe("ISO 8601", () => {
    it("reads date-only input as a wall date in the time zone, not UTC midnight", () => {
      expect(iso("2024-01-22", { timeZone: "Europe/Istanbul" })).toBe("2024-01-21T21:00:00.000Z");
    });

    it("reads date-times with and without offsets", () => {
      expect(iso("2024-01-22T14:30")).toBe("2024-01-22T14:30:00.000Z");
      expect(iso("2024-01-22 14:30:05.5")).toBe("2024-01-22T14:30:05.500Z");
      expect(iso("2024-01-22T14:30:00+03:00")).toBe("2024-01-22T11:30:00.000Z");
      expect(iso("2024-01-22T14:30:00z")).toBe("2024-01-22T14:30:00.000Z");
    });

    it("reads epoch milliseconds", () => {
      expect(iso("1705923000000")).toBe("2024-01-22T11:30:00.000Z");
    });

    it("rejects out-of-range fields", () => {
      expect(iso("2024-02-30")).toBeUndefined();
      expect(iso("2024-13-01")).toBeUndefined();
      expect(iso("2024-01-22T25:00")).toBeUndefined();
    });
  });

  describe("numeric fallback in locale order", () => {
    it("reads day/month/year for en-GB and tr", () => {
      expect(iso("22/01/2024")).toBe("2024-01-22T00:00:00.000Z");
      expect(iso("22.01.2024 14:30", { locale: "tr" })).toBe("2024-01-22T14:30:00.000Z");
      expect(iso("01/02/2024")).toBe("2024-02-01T00:00:00.000Z");
    });

    it("reads month/day/year for en-US and never swaps", () => {
      expect(iso("01/02/2024", { locale: "en-US" })).toBe("2024-01-02T00:00:00.000Z");
      expect(iso("1/22/24 9:05 pm", { locale: "en-US" })).toBe("2024-01-22T21:05:00.000Z");
      expect(iso("22/01/2024", { locale: "en-US" })).toBeUndefined();
    });

    it("reads year/month/day for ja", () => {
      expect(iso("2024/1/22", { locale: "ja" })).toBe("2024-01-22T00:00:00.000Z");
    });

    it("rejects garbage", () => {
      expect(iso("not a date")).toBeUndefined();
      expect(iso("22/01")).toBeUndefined();
    });
  });

  describe("input-format", () => {
    it("parses with a moment-style pattern only", () => {
      expect(iso("22/01/2024", { inputFormat: "DD/MM/YYYY", locale: "en-US" })).toBe("2024-01-22T00:00:00.000Z");
      expect(iso("2024-01-22", { inputFormat: "DD/MM/YYYY" })).toBeUndefined();
    });

    it("is lenient about padding and whitespace", () => {
      expect(iso("2/1/2024   9:5", { inputFormat: "DD/MM/YYYY HH:mm" })).toBe("2024-01-02T09:05:00.000Z");
    });

    it("parses localized names case-insensitively", () => {
      expect(iso("monday, 22 JANUARY 2024", { inputFormat: "dddd, D MMMM YYYY", locale: "en" })).toBe(
        "2024-01-22T00:00:00.000Z",
      );
      expect(iso("22 Ocak 2024", { inputFormat: "D MMMM YYYY", locale: "tr" })).toBe("2024-01-22T00:00:00.000Z");
    });

    it("parses 12-hour clocks", () => {
      expect(iso("12:15 AM", { inputFormat: "hh:mm A" })).toBe("2024-06-15T00:15:00.000Z");
      expect(iso("1/22/24 9:05 pm", { inputFormat: "M/D/YY h:mm a" })).toBe("2024-01-22T21:05:00.000Z");
      expect(iso("13:00 pm", { inputFormat: "h:mm a" })).toBeUndefined();
    });

    it("defaults: missing year is this year, time-only is today", () => {
      expect(iso("22/01", { inputFormat: "DD/MM" })).toBe("2024-01-22T00:00:00.000Z");
      expect(iso("14:30", { inputFormat: "HH:mm" })).toBe("2024-06-15T14:30:00.000Z");
    });

    it("parses offsets, fractions and timestamps", () => {
      expect(iso("2024-01-22 14:30 +0300", { inputFormat: "YYYY-MM-DD HH:mm ZZ" })).toBe("2024-01-22T11:30:00.000Z");
      expect(iso("09.5", { inputFormat: "ss.SSS" })).toBe("2024-06-15T00:00:09.500Z");
      expect(iso("1705923000", { inputFormat: "X" })).toBe("2024-01-22T11:30:00.000Z");
    });

    it("rejects impossible dates", () => {
      expect(iso("31/02/2024", { inputFormat: "DD/MM/YYYY" })).toBeUndefined();
    });
  });
});
