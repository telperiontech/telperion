# `<tp-date>`

A localized date/time, optionally live. No dependencies: names, presets and relative time come from `Intl`.

```html
<tp-date format="DD MMMM YYYY">2024-01-22</tp-date>          <!-- 22 January 2024 -->
<tp-date format="HH:mm:ss"></tp-date>                          <!-- live clock -->
<tp-date format="relative">2024-01-22T14:30:00Z</tp-date>      <!-- 3 days ago, kept up to date -->
<tp-date lang="tr" format="D MMMM YYYY dddd">22/01/2024</tp-date> <!-- 22 Ocak 2024 Pazartesi -->
```

## Setup

```ts
import "@telperion/elements/date";
```

It is also part of the root `@telperion/elements` import and of the all-in-one IIFE. Standalone script:

```html
<script src="https://unpkg.com/@telperion/elements/iife/date/index.js"></script>
```

## Attributes / properties

| Attribute      | Property      | Type                                              | Default | Description |
| -------------- | ------------- | ------------------------------------------------- | ------- | ----------- |
| `format`       | `format`      | `string`                                          | `""`    | `short`, `medium` (default), `long`, `full`, `relative`, or a [pattern](#tokens). |
| `date-style`   | `dateStyle`   | `"short" \| "medium" \| "long" \| "full" \| "none"` | &mdash; | Presets only. Overrides the date part; `none` omits it. |
| `time-style`   | `timeStyle`   | same                                              | &mdash; | Presets only. Overrides the time part; `none` omits it. |
| `input-format` | `inputFormat` | `string`                                          | `""`    | Pattern used to parse string input. When set, it is the only format accepted. |
| `datetime`     | `datetime`    | `string`                                          | `""`    | The date to show. Wins over the text content. |
| &mdash;        | `value`       | `Date \| number \| string`                        | &mdash; | The date to show. Wins over `datetime` and the text content. |
| `locale`       | `locale`      | `string`                                          | `""`    | BCP 47 tag. Defaults to the nearest `lang` attribute (also across shadow roots), then the browser. |
| `time-zone`    | `timeZone`    | `string`                                          | `""`    | IANA zone (`UTC`, `Europe/Istanbul`) for display and for parsing wall times. Unknown zones are ignored. Defaults to local. |
| `live`         | `live`        | `boolean`                                         | `false` | Forces ticking even for a fixed date in an absolute format. |
| `interval`     | `interval`    | `number`                                          | `0`     | Custom tick period in ms (min. 16). `0` derives it from the format. |
| `invalid`      | `invalid`     | `boolean`                                         | `false` | Read-only, reflected. Set when non-empty input could not be parsed. |

Read-only: `date` &mdash; the instant currently shown.

## Input

First non-empty source wins: `value` → `datetime` → text content. Strings are read as:

1. With `input-format`: that pattern only.
2. ISO 8601: `2024-01-22`, `2024-01-22T14:30`, `2024-01-22T14:30:05.123+03:00`. A date-only or offset-less ISO string is a **wall time** in `time-zone` (local by default), so `2024-01-22` never shows up as the 21st the way `new Date("2024-01-22")` can.
3. Epoch milliseconds: `1705923000000`.
4. Numeric dates in the locale's order: `22/01/2024`, `22.01.2024 14:30`, `1/22/24 9:05 pm`. `01/02/2024` is 1 February under `lang="tr"` or `en-GB`, 2 January under `en-US`. Values that don't fit the locale order are rejected, never swapped.

**Fallback:** empty input renders the current time (live). Invalid input renders the current time too, but also sets the `invalid` attribute and fires `tp-date-invalid` once per distinct input, so mistakes are visible:

```css
tp-date[invalid] { text-decoration: wavy underline red; }
```

The text content stays in light DOM, so it is what users see before the element upgrades (or without JavaScript).

## Format

- **Presets** map to `Intl.DateTimeFormat` `dateStyle` / `timeStyle`. `format="long" time-style="none"` → "January 22, 2024".
- **`relative`** uses `Intl.RelativeTimeFormat` with `numeric: "auto"` ("now", "yesterday", "in 3 hours"). Values are truncated toward zero, so "5 minutes ago" holds until the sixth minute. The `<time>` gets a `title` with the full date.
- **Patterns** use moment-style tokens. Digits are always Latin; names are localized.

### Tokens

| Token        | Output                              | Example (`en`, 2024-01-22 21:05:09.042 +03:00) |
| ------------ | ----------------------------------- | ---------------------------------------------- |
| `YYYY` `YY`  | Year                                | `2024` `24`                                    |
| `MMMM` `MMM` | Month name                          | `January` `Jan`                                |
| `MM` `M`     | Month                               | `01` `1`                                       |
| `DD` `D`     | Day of month                        | `22` `22`                                      |
| `dddd` `ddd` | Weekday name                        | `Monday` `Mon`                                 |
| `d`          | Weekday number (0 = Sunday)         | `1`                                            |
| `HH` `H`     | Hour 0-23                           | `21` `21`                                      |
| `hh` `h`     | Hour 1-12                           | `09` `9`                                       |
| `mm` `m`     | Minute                              | `05` `5`                                       |
| `ss` `s`     | Second                              | `09` `9`                                       |
| `SSS`        | Millisecond                         | `042`                                          |
| `A` `a`      | Day period                          | `PM` `pm`                                      |
| `Z` `ZZ`     | UTC offset                          | `+03:00` `+0300`                               |
| `X` `x`      | Unix seconds / milliseconds         | `1705946709` `1705946709042`                   |
| `[text]`     | Literal text                        | `[at] HH:mm` → `at 21:05`                      |

The same tokens parse `input-format`. Parsing is lenient like moment: padded tokens accept one digit, whitespace matches any whitespace, names match case-insensitively in the locale. Missing parts default to: year → this year; date → today (for time-only input); month/day → 1; time → 0.

## Live updates

A date ticks when it shows the current time, when `format="relative"`, or when `live` is set. Fixed dates in an absolute format never tick.

The cadence follows the format's finest unit, aligned to real clock boundaries (a `HH:mm` clock updates exactly at :00 of every minute, not 60 s after it loaded):

| Shown                          | Period                    |
| ------------------------------ | ------------------------- |
| `SSS` / `x`                    | 50 ms                     |
| seconds (`ss`, `X`, `medium`+ time style) | 1 s            |
| minutes (`mm`, `short` time style) | 1 min                 |
| hours, day periods, offsets    | 15 min \*                 |
| date only                      | 15 min \*                 |
| `relative`                     | 1 s under an hour, 1 min under a day, then 15 min |

\* Every current UTC offset is a multiple of 15 minutes, so a 15-minute epoch-aligned tick lands exactly on every zone's hour and midnight.

All elements share one timer per period, and timers pause while the tab is hidden (catching up the moment it's visible again). `interval` overrides the period.

## Events

| Event             | `detail`             | When |
| ----------------- | -------------------- | ---- |
| `tp-date-invalid` | `{ input: string }`  | Non-empty input could not be parsed (once per distinct input). |

## Styling

| Part / variable     | Description |
| ------------------- | ----------- |
| `::part(time)`      | The rendered `<time datetime="…">`. |
| `--tp-date-numeric` | `font-variant-numeric` of the output. Defaults to `tabular-nums`, so live clocks don't jitter. |

## Helpers

The building blocks are exported for use outside the element:

```ts
import { formatPattern, formatRelative, parseDate } from "@telperion/elements/date";

formatPattern(new Date(), "dddd, D MMMM YYYY", "tr");          // "Pazartesi, 22 Ocak 2024"
parseDate("22/01/2024", { inputFormat: "DD/MM/YYYY", now: Date.now() });
formatRelative(new Date(Date.now() - 180_000), Date.now(), "en"); // "3 minutes ago"
```
