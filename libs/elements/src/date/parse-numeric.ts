import { dateTimeFormat } from "./intl";
import { expandYear, type ParsedFields } from "./parse-fields";

type Part = "year" | "month" | "day";

const NUMERIC =
  /^(\d{1,4})\s*[./-]\s*(\d{1,4})\s*[./-]\s*(\d{1,4})(?:(?:\s+|\s*[T,]\s*)(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(am|pm)?)?$/i;
const orders = new Map<string, Part[]>();

/**
 * Order of day, month and year in the locale's numeric date
 * (`en-US` → month/day/year, `tr`/`en-GB` → day/month/year, `ja` → year/month/day).
 */
export function localeDateOrder(locale: string | undefined): Part[] {
  const key = locale ?? "";
  let order = orders.get(key);

  if (!order) {
    order = dateTimeFormat(locale, { timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric" })
      .formatToParts(Date.UTC(2000, 0, 2))
      .map(part => part.type)
      .filter((type): type is Part => type === "year" || type === "month" || type === "day");
    orders.set(key, order);
  }

  return order;
}

/**
 * Fallback for numeric dates without an `input-format`, such as `22/01/2024`
 * or `22.01.2024 14:30`. Day, month and year are read in the locale's order,
 * so `01/02/2024` is 1 February in `tr` and January 2 in `en-US`. Values that
 * don't fit that order (day 22 as a US month) are rejected, never swapped.
 */
export function parseNumeric(input: string, locale?: string): ParsedFields | undefined {
  const match = NUMERIC.exec(input);
  const order = localeDateOrder(locale);

  if (!match || order.length !== 3) return undefined;

  const [, first, second, third, hour, minute, seconds, period] = match;
  const parsed: ParsedFields = {};

  [first, second, third].forEach((value, index) => {
    const part = order[index];

    parsed[part] = part === "year" ? expandYear(value) : Number(value);
  });

  if (hour !== undefined) {
    parsed.hour = Number(hour);
    parsed.minute = Number(minute);
    parsed.second = seconds === undefined ? 0 : Number(seconds);

    if (period) parsed.pm = period.toLowerCase() === "pm";
  }

  return parsed;
}
