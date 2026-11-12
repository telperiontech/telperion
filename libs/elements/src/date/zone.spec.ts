import { describe, expect, it } from "vitest";

import { daysInMonth, formatOffset, fromFields, getFields, isValidTimeZone, offsetMinutes } from "./zone";

const fields = { year: 2024, month: 1, day: 22, hour: 14, minute: 30, second: 0, millisecond: 0 };

describe("zone", () => {
  it("reads wall-clock fields in a time zone", () => {
    const date = new Date("2024-01-22T11:30:05.250Z");

    expect(getFields(date, "Europe/Istanbul")).toEqual({
      year: 2024,
      month: 1,
      day: 22,
      hour: 14,
      minute: 30,
      second: 5,
      millisecond: 250,
      weekday: 1,
    });
  });

  it("computes offsets, including DST", () => {
    expect(offsetMinutes(new Date("2024-01-22T12:00:00Z"), "Europe/Istanbul")).toBe(180);
    expect(offsetMinutes(new Date("2024-01-22T12:00:00Z"), "America/New_York")).toBe(-300);
    expect(offsetMinutes(new Date("2024-07-22T12:00:00Z"), "America/New_York")).toBe(-240);
    expect(offsetMinutes(new Date("2024-07-22T12:00:00Z"), "Asia/Kathmandu")).toBe(345);
  });

  it("converts wall-clock fields to an instant in a time zone", () => {
    expect(fromFields(fields, "Europe/Istanbul").toISOString()).toBe("2024-01-22T11:30:00.000Z");
    expect(fromFields(fields, "UTC").toISOString()).toBe("2024-01-22T14:30:00.000Z");
    expect(fromFields({ ...fields, month: 7 }, "America/New_York").toISOString()).toBe("2024-07-22T18:30:00.000Z");
  });

  it("uses local time without a time zone", () => {
    const date = fromFields(fields);

    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2024, 0, 22, 14]);
  });

  it("counts days in a month", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(2024, 12)).toBe(31);
  });

  it("formats offsets", () => {
    expect(formatOffset(180)).toBe("+03:00");
    expect(formatOffset(-570, "")).toBe("-0930");
  });

  it("validates time zones", () => {
    expect(isValidTimeZone("Europe/Istanbul")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});
