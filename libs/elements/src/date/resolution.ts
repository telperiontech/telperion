import type { FormatSpec } from "./format";
import { relativePeriod } from "./relative";
import { tokenize, type Token } from "./tokens";

const SECOND = 1000;
const MINUTE = 60 * SECOND;

/**
 * Tick periods per unit. Hour and day changes are checked every 15 minutes:
 * every current UTC offset is a multiple of 15 minutes, so a 15-minute,
 * epoch-aligned tick lands exactly on every zone's hour and midnight.
 * Milliseconds tick at ~20 fps; faster is invisible.
 */
export const PERIODS = {
  millisecond: 50,
  second: SECOND,
  minute: MINUTE,
  hour: 15 * MINUTE,
  day: 15 * MINUTE,
} as const;

type Unit = keyof typeof PERIODS;

const TOKEN_UNITS: Partial<Record<Token, Unit>> = {
  SSS: "millisecond",
  x: "millisecond",
  ss: "second",
  s: "second",
  X: "second",
  mm: "minute",
  m: "minute",
  HH: "hour",
  H: "hour",
  hh: "hour",
  h: "hour",
  A: "hour",
  a: "hour",
  // Offsets change at DST transitions, which happen on the hour.
  ZZ: "hour",
  Z: "hour",
};
const TIME_STYLE_UNITS: Record<string, Unit> = {
  short: "minute",
  medium: "second",
  long: "second",
  full: "second",
};

/**
 * How often (ms) a date rendered with `spec` can change. Ticks are aligned to
 * multiples of this period, so second/minute changes show up exactly on time.
 */
export function tickPeriod(spec: FormatSpec, date: Date, now: number): number {
  switch (spec.kind) {
    case "relative":
      return relativePeriod(date, now);
    case "preset":
      return PERIODS[spec.timeStyle ? TIME_STYLE_UNITS[spec.timeStyle] : "day"];
    case "pattern":
      return Math.min(
        PERIODS.day,
        ...tokenize(spec.pattern).map(part => ("token" in part ? PERIODS[TOKEN_UNITS[part.token] ?? "day"] : PERIODS.day)),
      );
  }
}
