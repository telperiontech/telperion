import { dayPeriods, monthNames, weekdayNames } from "./names";
import { expandYear, fractionToMs, parseOffset, type ParsedFields } from "./parse-fields";
import { tokenize, type Token } from "./tokens";

type Apply = (parsed: ParsedFields, value: string, locale: string | undefined) => boolean | void;

interface TokenRule {
  source: (locale: string | undefined) => string;
  apply: Apply;
}

const number = (source: string, key: keyof ParsedFields): TokenRule => ({
  source: () => source,
  apply: (parsed, value) => {
    parsed[key] = Number(value) as never;
  },
});
const names = (list: (locale: string | undefined) => string[], key?: "month"): TokenRule => ({
  source: locale => alternation(list(locale)),
  apply: (parsed, value, locale) => {
    if (!key) return true;

    const index = indexOfName(list(locale), value, locale);

    if (index === -1) return false;

    parsed[key] = index + 1;

    return true;
  },
});
const period: TokenRule = {
  source: locale => alternation([...dayPeriods(locale), "am", "pm"]),
  apply: (parsed, value, locale) => {
    const [am, pm] = dayPeriods(locale).map(name => name.toLocaleLowerCase(locale));
    const lower = value.toLocaleLowerCase(locale);

    parsed.pm = lower === pm || lower === "pm" ? true : lower === am || lower === "am" ? false : undefined;
  },
};
const offset: TokenRule = {
  source: () => "Z|[+-]\\d{2}:?\\d{2}",
  apply: (parsed, value) => {
    parsed.offset = parseOffset(value.toUpperCase());
  },
};
/** Parsing is lenient like moment: padded tokens also accept one digit. */
const RULES: Record<Token, TokenRule> = {
  YYYY: { source: () => "[+-]?\\d{4,6}", apply: (parsed, value) => void (parsed.year = Number(value)) },
  YY: { source: () => "\\d{2}", apply: (parsed, value) => void (parsed.year = expandYear(value)) },
  MMMM: names(locale => monthNames(locale, "long"), "month"),
  MMM: names(locale => monthNames(locale, "short"), "month"),
  MM: number("\\d{1,2}", "month"),
  M: number("\\d{1,2}", "month"),
  DD: number("\\d{1,2}", "day"),
  D: number("\\d{1,2}", "day"),
  dddd: names(locale => weekdayNames(locale, "long")),
  ddd: names(locale => weekdayNames(locale, "short")),
  d: { source: () => "[0-6]", apply: () => undefined },
  HH: number("\\d{1,2}", "hour"),
  H: number("\\d{1,2}", "hour"),
  hh: number("\\d{1,2}", "hour"),
  h: number("\\d{1,2}", "hour"),
  mm: number("\\d{1,2}", "minute"),
  m: number("\\d{1,2}", "minute"),
  ss: number("\\d{1,2}", "second"),
  s: number("\\d{1,2}", "second"),
  SSS: { source: () => "\\d{1,9}", apply: (parsed, value) => void (parsed.millisecond = fractionToMs(value)) },
  A: period,
  a: period,
  ZZ: offset,
  Z: offset,
  X: { source: () => "-?\\d+(?:\\.\\d+)?", apply: (parsed, value) => void (parsed.timestamp = Math.round(Number(value) * 1000)) },
  x: { source: () => "-?\\d+", apply: (parsed, value) => void (parsed.timestamp = Number(value)) },
};

interface Compiled {
  regex: RegExp;
  tokens: Token[];
}

const cache = new Map<string, Compiled>();

function compile(pattern: string, locale: string | undefined): Compiled {
  const key = `${locale ?? ""}|${pattern}`;
  let compiled = cache.get(key);

  if (!compiled) {
    const tokens: Token[] = [];
    const source = tokenize(pattern)
      .map(part => {
        if ("literal" in part) return escape(part.literal).replace(/\s+/g, "\\s+");

        tokens.push(part.token);

        return `(${RULES[part.token].source(locale)})`;
      })
      .join("");

    compiled = { regex: new RegExp(`^${source}$`, "iu"), tokens };
    cache.set(key, compiled);
  }

  return compiled;
}

/**
 * Parses `input` with a moment-style pattern (`DD/MM/YYYY HH:mm`). Month,
 * weekday and AM/PM names are matched case-insensitively in `locale`;
 * whitespace in the pattern matches any run of whitespace.
 */
export function parsePattern(input: string, pattern: string, locale?: string): ParsedFields | undefined {
  const { regex, tokens } = compile(pattern, locale);
  const match = regex.exec(input);

  if (!match) return undefined;

  const parsed: ParsedFields = {};

  for (const [index, token] of tokens.entries()) {
    if (RULES[token].apply(parsed, match[index + 1], locale) === false) return undefined;
  }

  if (parsed.pm !== undefined && !tokens.some(token => token === "h" || token === "hh")) {
    // AM/PM next to a 24-hour token: trust the 24-hour value.
    parsed.pm = undefined;
  }

  return parsed;
}

function alternation(list: string[]): string {
  return [...new Set(list.filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join("|");
}

function indexOfName(list: string[], value: string, locale: string | undefined): number {
  const lower = value.toLocaleLowerCase(locale);

  return list.findIndex(name => name.toLocaleLowerCase(locale) === lower);
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
