import { dateTimeFormat, partValue } from "./intl";
import type { DateFields } from "./types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Wall-clock fields of `date` in `timeZone` (an IANA name such as
 * `Europe/Istanbul`). Without a time zone the runtime's local zone is used.
 */
export function getFields(date: Date, timeZone?: string): DateFields {
  if (!timeZone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
      millisecond: date.getMilliseconds(),
      weekday: date.getDay(),
    };
  }

  const parts = dateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    era: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    weekday: "short",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(partValue(parts, type));
  const year = read("year");

  return {
    year: partValue(parts, "era") === "BC" ? 1 - year : year,
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
    millisecond: date.getUTCMilliseconds(),
    weekday: WEEKDAYS.indexOf(partValue(parts, "weekday") ?? ""),
  };
}

/** UTC timestamp of the given wall-clock fields, as if they were in UTC. Handles years 0-99. */
export function utcFromFields(fields: Omit<DateFields, "weekday">): number {
  const date = new Date(0);

  date.setUTCFullYear(fields.year, fields.month - 1, fields.day);
  date.setUTCHours(fields.hour, fields.minute, fields.second, fields.millisecond);

  return date.getTime();
}

/** Offset of `timeZone` from UTC at `date`, in minutes (east positive, e.g. `+180` for Istanbul). */
export function offsetMinutes(date: Date, timeZone?: string): number {
  if (!timeZone) return -date.getTimezoneOffset();

  return Math.round((utcFromFields(getFields(date, timeZone)) - date.getTime()) / 60_000);
}

/**
 * The instant at which the wall clock in `timeZone` shows `fields`. In a DST
 * gap the time is shifted forward, matching how `Date` handles local times.
 */
export function fromFields(fields: Omit<DateFields, "weekday">, timeZone?: string): Date {
  if (!timeZone) {
    const date = new Date(0);

    date.setFullYear(fields.year, fields.month - 1, fields.day);
    date.setHours(fields.hour, fields.minute, fields.second, fields.millisecond);

    return date;
  }

  const guess = utcFromFields(fields);
  const first = offsetMinutes(new Date(guess), timeZone);
  const time = guess - first * 60_000;
  const second = offsetMinutes(new Date(time), timeZone);

  return new Date(second === first ? time : guess - second * 60_000);
}

/** Number of days in a month (`month` is 1-12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(utcFromFields({ year, month: month + 1, day: 0, hour: 0, minute: 0, second: 0, millisecond: 0 })).getUTCDate();
}

/** Formats an offset in minutes as `+03:00` (or `+0300` without a separator). */
export function formatOffset(minutes: number, separator = ":"): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);

  return `${sign}${pad(Math.floor(abs / 60))}${separator}${pad(abs % 60)}`;
}

/** `true` when `timeZone` is a zone the runtime's `Intl` understands. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    dateTimeFormat(undefined, { timeZone });

    return true;
  } catch {
    return false;
  }
}

export function pad(value: number, length = 2): string {
  return String(Math.abs(value)).padStart(length, "0");
}
