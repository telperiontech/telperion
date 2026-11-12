import { relativeTimeFormat } from "./intl";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", YEAR],
  ["month", MONTH],
  ["week", WEEK],
  ["day", DAY],
  ["hour", HOUR],
  ["minute", MINUTE],
];

/**
 * Formats `date` relative to `now` ("3 minutes ago", "in 2 days", "now").
 * Picks the largest unit that fits and truncates toward zero, so "5 minutes
 * ago" holds until the sixth minute has passed.
 */
export function formatRelative(date: Date, now: number, locale?: string): string {
  const diff = date.getTime() - now;
  const abs = Math.abs(diff);
  const [unit, size] = UNITS.find(([, size]) => abs >= size) ?? ["second", SECOND];

  // `|| 0` turns -0 into 0, which formats as "now" instead of "0 seconds ago".
  return relativeTimeFormat(locale).format(Math.trunc(diff / size) || 0, unit);
}

/**
 * How often a relative date needs re-rendering. Labels change fastest close to
 * now, so the cadence slows down as the date gets further away.
 */
export function relativePeriod(date: Date, now: number): number {
  const abs = Math.abs(date.getTime() - now);

  if (abs < HOUR) return SECOND;

  if (abs < DAY) return MINUTE;

  return 15 * MINUTE;
}
