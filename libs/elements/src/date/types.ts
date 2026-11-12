/** `Intl.DateTimeFormat` style used by the preset formats (`short`, `medium`, `long`, `full`). */
export type DateStyle = "short" | "medium" | "long" | "full";

/** Per-part override for presets: a style, or `none` to omit that part. */
export type DateStyleOverride = DateStyle | "none";

/** Accepted by the `value` property. Strings are parsed like the text content. */
export type DateInput = Date | number | string;

/**
 * Wall-clock fields of an instant in a given time zone.
 * `month` is 1-12, `weekday` is 0 (Sunday) - 6.
 */
export interface DateFields {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
  weekday: number;
}

/** `detail` of the `tp-date-invalid` event. */
export interface DateInvalidEventDetail {
  /** The input that could not be parsed. */
  input: string;
}
