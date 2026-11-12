import { expandYear, fractionToMs, parseOffset, type ParsedFields } from "./parse-fields";

const ISO =
  /^([+-]\d{6}|\d{4})-(\d{2})(?:-(\d{2}))?(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?)?$/i;
const EPOCH = /^-?\d+$/;

/**
 * Parses ISO 8601 (`2024-01-22`, `2024-01-22T14:30`, `2024-01-22T14:30:05.123+03:00`)
 * and epoch milliseconds (`1705923000000`).
 *
 * Unlike `Date.parse`, a date-only ISO string is a local (or `time-zone`) date
 * rather than UTC midnight, so `2024-01-22` never renders as the 21st.
 */
export function parseIso(input: string): ParsedFields | undefined {
  if (EPOCH.test(input) && input.replace("-", "").length > 4) return { timestamp: Number(input) };

  const match = ISO.exec(input);

  if (!match) return undefined;

  const [, year, month, day, hour, minute, second, fraction, offset] = match;
  const parsed: ParsedFields = {
    year: expandYear(year),
    month: Number(month),
    day: day === undefined ? 1 : Number(day),
  };

  if (hour !== undefined) {
    parsed.hour = Number(hour);
    parsed.minute = Number(minute);
    parsed.second = second === undefined ? 0 : Number(second);
    parsed.millisecond = fraction === undefined ? 0 : fractionToMs(fraction);
  }

  if (offset !== undefined) {
    parsed.offset = parseOffset(offset.toUpperCase());

    if (parsed.offset === undefined) return undefined;
  }

  return parsed;
}
