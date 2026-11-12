import { dateTimeFormat, partValue } from "./intl";

export type NameWidth = "short" | "long";

const cache = new Map<string, string[]>();

function cached(key: string, build: () => string[]): string[] {
  let names = cache.get(key);

  if (!names) {
    names = build();
    cache.set(key, names);
  }

  return names;
}

/** Localized month names, January first. Uses the "format" form (as in "22 January"). */
export function monthNames(locale: string | undefined, width: NameWidth): string[] {
  return cached(`month|${locale}|${width}`, () => {
    const format = dateTimeFormat(locale, { timeZone: "UTC", day: "numeric", month: width });

    return Array.from({ length: 12 }, (_, month) => partValue(format.formatToParts(Date.UTC(2000, month, 15)), "month") ?? "");
  });
}

/** Localized weekday names, Sunday first. */
export function weekdayNames(locale: string | undefined, width: NameWidth): string[] {
  return cached(`weekday|${locale}|${width}`, () => {
    const format = dateTimeFormat(locale, { timeZone: "UTC", weekday: width });

    // 2000-01-02 was a Sunday.
    return Array.from({ length: 7 }, (_, day) => format.format(Date.UTC(2000, 0, 2 + day)));
  });
}

/** Localized day periods as `[am, pm]`. Falls back to `AM` / `PM`. */
export function dayPeriods(locale: string | undefined): [string, string] {
  return cached(`period|${locale}`, () => {
    const format = dateTimeFormat(locale, { timeZone: "UTC", hour: "numeric", hourCycle: "h12" });
    const read = (hour: number, fallback: string) =>
      partValue(format.formatToParts(Date.UTC(2000, 0, 1, hour)), "dayPeriod") ?? fallback;

    return [read(9, "AM"), read(21, "PM")];
  }) as [string, string];
}
