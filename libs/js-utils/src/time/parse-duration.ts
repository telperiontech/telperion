import { days } from '@telperion/js-utils/time/days';
import { hours } from '@telperion/js-utils/time/hours';
import { minutes } from '@telperion/js-utils/time/minutes';
import { seconds } from '@telperion/js-utils/time/seconds';
import { weeks } from '@telperion/js-utils/time/weeks';

/**
 * Units {@link parseDuration} accepts, with their converters to milliseconds
 */
const DURATION_UNITS = {
  ms: (value: number) => value,
  s: seconds,
  m: minutes,
  h: hours,
  d: days,
  w: weeks,
} as const satisfies Record<string, (value: number) => number>;

/**
 * A unit {@link parseDuration} accepts: `ms`, `s`, `m`, `h`, `d` or `w`
 */
export type DurationUnit = keyof typeof DURATION_UNITS;

const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d|w)$/;

/**
 * Parses a `<number><unit>` duration string (e.g. `15m`, `30d`) into milliseconds
 *
 * Units: `ms` (milliseconds), `s` (seconds), `m` (minutes), `h` (hours), `d` (days), `w` (weeks).
 * Months and years are not accepted: their length varies, and `m` already means minutes.
 *
 * Format rules:
 * - The amount is a non-negative whole number: `1.5h` and `-5m` throw; write `90m` instead of `1.5h`.
 * - Units are lowercase and follow the number directly: `15 m` and `15M` throw.
 * - Whitespace around the value is ignored.
 * - The result must be a safe integer.
 *
 * #### Example
 * ```typescript
 * import { parseDuration } from "@telperion/js-utils/time";
 *
 * parseDuration('15m'); // 900000
 * parseDuration(' 30d '); // 2592000000
 * parseDuration(process.env.SESSION_TTL ?? '7d');
 * ```
 *
 * @param value - Duration such as `15m` or `30d`
 * @returns Equivalent value in milliseconds
 * @throws {Error} When the value is not a valid duration
 */
export function parseDuration(value: string): number {
  const [, amount, unit] = (typeof value === 'string' && DURATION_PATTERN.exec(value.trim())) || [];
  const milliseconds = amount && unit ? DURATION_UNITS[unit as DurationUnit](Number(amount)) : Number.NaN;

  if (!Number.isSafeInteger(milliseconds)) {
    throw new Error(
      `Invalid duration ${typeof value === 'string' ? JSON.stringify(value) : `(${typeof value})`}, expected a whole number followed by ms, s, m, h, d or w (e.g. 15m or 30d)`,
    );
  }

  return milliseconds;
}
