import { daysInMonth, fromFields, getFields, utcFromFields } from "./zone";

/** Fields extracted by a parser; anything missing gets a default. */
export interface ParsedFields {
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
  /** `true` = PM, `false` = AM; `hour` is then on a 12-hour clock. */
  pm?: boolean;
  /** Explicit UTC offset in minutes; wins over the time zone. */
  offset?: number;
  /** Explicit epoch milliseconds; wins over everything else. */
  timestamp?: number;
}

export interface AssembleOptions {
  timeZone?: string;
  /** Used for defaults: a missing year is this year, a time-only input is today. */
  now: number;
}

/**
 * Turns parsed fields into an instant, or `undefined` when a field is out of
 * range (e.g. month 13 or 31 February).
 *
 * Defaults follow moment: a missing year is the current one; when no date
 * part was given at all the date is today; a missing month/day is 1; missing
 * time fields are 0. Wall times are read in `timeZone` (local when unset)
 * unless the input carried its own offset.
 */
export function assemble(parsed: ParsedFields, { timeZone, now }: AssembleOptions): Date | undefined {
  if (parsed.timestamp !== undefined) return Number.isFinite(parsed.timestamp) ? new Date(parsed.timestamp) : undefined;

  const today = getFields(new Date(now), timeZone);
  const hasDate = parsed.year !== undefined || parsed.month !== undefined || parsed.day !== undefined;
  const fields = {
    year: parsed.year ?? today.year,
    month: parsed.month ?? (hasDate ? 1 : today.month),
    day: parsed.day ?? (hasDate ? 1 : today.day),
    hour: parsed.hour ?? 0,
    minute: parsed.minute ?? 0,
    second: parsed.second ?? 0,
    millisecond: parsed.millisecond ?? 0,
  };

  if (parsed.pm !== undefined) {
    if (fields.hour < 1 || fields.hour > 12) return undefined;

    fields.hour = (fields.hour % 12) + (parsed.pm ? 12 : 0);
  }

  if (!inRange(fields)) return undefined;

  if (parsed.offset !== undefined) return new Date(utcFromFields(fields) - parsed.offset * 60_000);

  return fromFields(fields, timeZone);
}

function inRange(f: Required<Omit<ParsedFields, "pm" | "offset" | "timestamp">>): boolean {
  return (
    Object.values(f).every(Number.isInteger) &&
    f.month >= 1 &&
    f.month <= 12 &&
    f.day >= 1 &&
    f.day <= daysInMonth(f.year, f.month) &&
    f.hour >= 0 &&
    f.hour <= 23 &&
    f.minute >= 0 &&
    f.minute <= 59 &&
    f.second >= 0 &&
    f.second <= 59 &&
    f.millisecond >= 0 &&
    f.millisecond <= 999
  );
}

/** Two-digit years: `00`-`68` → 2000s, `69`-`99` → 1900s (same pivot as moment). */
export function expandYear(digits: string): number {
  const value = Number(digits);

  if (digits.length > 2) return value;

  return value + (value <= 68 ? 2000 : 1900);
}

/** Fractional seconds (`5`, `50`, `500`, `500123`) → milliseconds. */
export function fractionToMs(digits: string): number {
  return Number(digits.slice(0, 3).padEnd(3, "0"));
}

/** `Z`, `+03:00`, `+0300` or `+03` → minutes east of UTC. */
export function parseOffset(value: string): number | undefined {
  if (/^z$/i.test(value)) return 0;

  const match = /^([+-])(\d{2}):?(\d{2})?$/.exec(value);

  if (!match) return undefined;

  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);

  return match[1] === "-" ? -minutes : minutes;
}
