const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();
const relativeTimeFormats = new Map<string, Intl.RelativeTimeFormat>();

/**
 * Cached `Intl.DateTimeFormat`. Constructing formatters is the expensive part
 * of `Intl`, and live dates re-format on every tick.
 */
export function dateTimeFormat(locale: string | undefined, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale ?? ""}|${JSON.stringify(options)}`;
  let format = dateTimeFormats.get(key);

  if (!format) {
    format = new Intl.DateTimeFormat(locale, options);
    dateTimeFormats.set(key, format);
  }

  return format;
}

/** Cached `Intl.RelativeTimeFormat` with `numeric: "auto"` ("yesterday", "now"). */
export function relativeTimeFormat(locale: string | undefined): Intl.RelativeTimeFormat {
  const key = locale ?? "";
  let format = relativeTimeFormats.get(key);

  if (!format) {
    format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    relativeTimeFormats.set(key, format);
  }

  return format;
}

/** Returns the value of the first part of `type`, if any. */
export function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string | undefined {
  return parts.find(part => part.type === type)?.value;
}
