import { assemble } from "./parse-fields";
import { parseIso } from "./parse-iso";
import { parseNumeric } from "./parse-numeric";
import { parsePattern } from "./parse-pattern";
import type { DateInput } from "./types";

export interface ParseOptions {
  /** Moment-style pattern. When set, it is the only format tried. */
  inputFormat?: string;
  locale?: string;
  /** Zone for wall times without an explicit offset. Local when unset. */
  timeZone?: string;
  /** Reference time for defaults (missing year, time-only input). */
  now: number;
}

/**
 * Parses a date input. Returns `undefined` for empty or invalid input.
 *
 * - `Date` → used as is (if valid). `number` → epoch milliseconds.
 * - Strings with `inputFormat` → that pattern only.
 * - Other strings → ISO 8601 / epoch ms, then a numeric date in the locale's
 *   day/month/year order (`22/01/2024`, `22.01.2024 14:30`).
 */
export function parseDate(input: DateInput | null | undefined, options: ParseOptions): Date | undefined {
  if (input instanceof Date) return valid(new Date(input.getTime()));

  if (typeof input === "number") return valid(new Date(input));

  const text = input?.trim();

  if (!text) return undefined;

  const parsed = options.inputFormat?.trim()
    ? parsePattern(text, options.inputFormat, options.locale)
    : (parseIso(text) ?? parseNumeric(text, options.locale));

  return valid(parsed && assemble(parsed, options));
}

/** Drops `Invalid Date`s (NaN, or beyond the ±8.64e15 ms range `Date` supports). */
function valid(date: Date | undefined): Date | undefined {
  return date && !Number.isNaN(date.getTime()) ? date : undefined;
}
