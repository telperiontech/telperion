/**
 * Moment-style tokens shared by formatting (`format`) and parsing
 * (`input-format`). Ordered longest-first so the tokenizer is greedy.
 *
 * | Token        | Meaning                              |
 * | ------------ | ------------------------------------ |
 * | `YYYY` `YY`  | Year (4 digits / 2 digits)           |
 * | `MMMM` `MMM` | Month name (long / short, localized) |
 * | `MM` `M`     | Month number (padded / unpadded)     |
 * | `DD` `D`     | Day of month                         |
 * | `dddd` `ddd` | Weekday name (long / short)          |
 * | `d`          | Weekday number (0 = Sunday)          |
 * | `HH` `H`     | Hour 0-23                            |
 * | `hh` `h`     | Hour 1-12                            |
 * | `mm` `m`     | Minute                               |
 * | `ss` `s`     | Second                               |
 * | `SSS`        | Millisecond                          |
 * | `A` `a`      | Day period (AM/PM, localized)        |
 * | `ZZ` `Z`     | UTC offset (`+0300` / `+03:00`)      |
 * | `X` `x`      | Unix seconds / milliseconds          |
 *
 * Text in `[brackets]` is literal. Any other character is literal too.
 */
export const TOKENS = [
  "YYYY",
  "MMMM",
  "dddd",
  "MMM",
  "ddd",
  "SSS",
  "YY",
  "MM",
  "DD",
  "HH",
  "hh",
  "mm",
  "ss",
  "ZZ",
  "M",
  "D",
  "d",
  "H",
  "h",
  "m",
  "s",
  "A",
  "a",
  "Z",
  "X",
  "x",
] as const;

export type Token = (typeof TOKENS)[number];

export type PatternPart = { token: Token } | { literal: string };

const cache = new Map<string, PatternPart[]>();

/** Splits a pattern into tokens and literals. Results are cached per pattern. */
export function tokenize(pattern: string): PatternPart[] {
  let parts = cache.get(pattern);

  if (parts) return parts;

  parts = [];

  let literal = "";
  let i = 0;
  const flush = () => {
    if (literal) parts!.push({ literal });
    literal = "";
  };

  while (i < pattern.length) {
    if (pattern[i] === "[") {
      const end = pattern.indexOf("]", i + 1);

      if (end !== -1) {
        literal += pattern.slice(i + 1, end);
        i = end + 1;

        continue;
      }
    }

    const token = TOKENS.find(candidate => pattern.startsWith(candidate, i));

    if (token) {
      flush();
      parts.push({ token });
      i += token.length;
    } else {
      literal += pattern[i++];
    }
  }

  flush();
  cache.set(pattern, parts);

  return parts;
}
