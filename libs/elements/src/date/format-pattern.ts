import { dayPeriods, monthNames, weekdayNames } from "./names";
import { tokenize, type Token } from "./tokens";
import type { DateFields } from "./types";
import { formatOffset, getFields, offsetMinutes, pad } from "./zone";

interface Context {
  date: Date;
  fields: DateFields;
  locale: string | undefined;
  timeZone: string | undefined;
}

const hour12 = (hour: number) => hour % 12 || 12;
const FORMATTERS: Record<Token, (context: Context) => string> = {
  YYYY: ({ fields }) => (fields.year < 0 ? "-" : "") + pad(fields.year, 4),
  YY: ({ fields }) => pad(fields.year % 100),
  MMMM: ({ fields, locale }) => monthNames(locale, "long")[fields.month - 1],
  MMM: ({ fields, locale }) => monthNames(locale, "short")[fields.month - 1],
  MM: ({ fields }) => pad(fields.month),
  M: ({ fields }) => String(fields.month),
  DD: ({ fields }) => pad(fields.day),
  D: ({ fields }) => String(fields.day),
  dddd: ({ fields, locale }) => weekdayNames(locale, "long")[fields.weekday],
  ddd: ({ fields, locale }) => weekdayNames(locale, "short")[fields.weekday],
  d: ({ fields }) => String(fields.weekday),
  HH: ({ fields }) => pad(fields.hour),
  H: ({ fields }) => String(fields.hour),
  hh: ({ fields }) => pad(hour12(fields.hour)),
  h: ({ fields }) => String(hour12(fields.hour)),
  mm: ({ fields }) => pad(fields.minute),
  m: ({ fields }) => String(fields.minute),
  ss: ({ fields }) => pad(fields.second),
  s: ({ fields }) => String(fields.second),
  SSS: ({ fields }) => pad(fields.millisecond, 3),
  A: ({ fields, locale }) => dayPeriods(locale)[fields.hour < 12 ? 0 : 1],
  a: ({ fields, locale }) => dayPeriods(locale)[fields.hour < 12 ? 0 : 1].toLocaleLowerCase(locale),
  ZZ: ({ date, timeZone }) => formatOffset(offsetMinutes(date, timeZone), ""),
  Z: ({ date, timeZone }) => formatOffset(offsetMinutes(date, timeZone)),
  X: ({ date }) => String(Math.floor(date.getTime() / 1000)),
  x: ({ date }) => String(date.getTime()),
};

/**
 * Formats `date` with a moment-style pattern (see `tokens.ts`). Numbers are
 * always Latin digits; month, weekday and day-period names come from `Intl`
 * in the given locale.
 */
export function formatPattern(date: Date, pattern: string, locale?: string, timeZone?: string): string {
  const context: Context = { date, fields: getFields(date, timeZone), locale, timeZone };

  return tokenize(pattern)
    .map(part => ("token" in part ? FORMATTERS[part.token](context) : part.literal))
    .join("");
}
