import { formatPattern } from "./format-pattern";
import { dateTimeFormat } from "./intl";
import { formatRelative } from "./relative";
import type { DateStyle, DateStyleOverride } from "./types";

export const PRESETS: readonly DateStyle[] = ["short", "medium", "long", "full"];
export const DEFAULT_PRESET: DateStyle = "medium";

/** A parsed `format` attribute. */
export type FormatSpec =
  | { kind: "relative" }
  | { kind: "pattern"; pattern: string }
  | { kind: "preset"; dateStyle?: DateStyle; timeStyle?: DateStyle };

export interface FormatOptions {
  locale?: string;
  timeZone?: string;
  /** Reference time for relative formatting. */
  now: number;
}

/**
 * Interprets the `format`, `date-style` and `time-style` attributes.
 *
 * - `relative` → relative time ("3 minutes ago").
 * - A preset name (`short`, `medium`, `long`, `full`) or empty → `Intl`
 *   `dateStyle` + `timeStyle`, each overridable (or omitted with `none`).
 * - Anything else → a moment-style token pattern.
 */
export function resolveFormat(format: string, dateStyle?: DateStyleOverride, timeStyle?: DateStyleOverride): FormatSpec {
  const value = format.trim();

  if (value === "relative") return { kind: "relative" };

  if (value && !PRESETS.includes(value as DateStyle)) return { kind: "pattern", pattern: format };

  const preset = (value || DEFAULT_PRESET) as DateStyle;
  const date = pickStyle(dateStyle, preset);
  const time = pickStyle(timeStyle, preset);

  // Both parts omitted would render nothing; keep the date.
  if (!date && !time) return { kind: "preset", dateStyle: preset };

  return { kind: "preset", dateStyle: date, timeStyle: time };
}

function pickStyle(override: DateStyleOverride | undefined, preset: DateStyle): DateStyle | undefined {
  if (override === "none") return undefined;

  return override && PRESETS.includes(override) ? override : preset;
}

/** Renders `date` according to a resolved format. */
export function formatDate(date: Date, spec: FormatSpec, { locale, timeZone, now }: FormatOptions): string {
  switch (spec.kind) {
    case "relative":
      return formatRelative(date, now, locale);
    case "pattern":
      return formatPattern(date, spec.pattern, locale, timeZone);
    case "preset":
      return dateTimeFormat(locale, { dateStyle: spec.dateStyle, timeStyle: spec.timeStyle, timeZone }).format(date);
  }
}

/** A full, unambiguous rendering used for the tooltip of relative dates. */
export function formatFull(date: Date, locale?: string, timeZone?: string): string {
  return dateTimeFormat(locale, { dateStyle: "full", timeStyle: "long", timeZone }).format(date);
}
