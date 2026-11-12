import type { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import "./date-element";

/**
 * `<tp-date>` renders a localized, optionally live date/time with `Intl`
 * presets, relative time, or moment-style patterns.
 */
interface Args {
  input: string;
  format: string;
  inputFormat: string;
  locale: string;
  timeZone: string;
  live: boolean;
}

const FORMATS = ["", "short", "medium", "long", "full", "relative", "DD/MM/YYYY", "dddd, D MMMM YYYY HH:mm", "HH:mm:ss", "h:mm:ss.SSS A"];
const LOCALES = ["", "en-US", "en-GB", "tr", "de", "fr", "ja", "ar-EG"];
const ZONES = ["", "UTC", "Europe/Istanbul", "America/New_York", "Asia/Tokyo", "Asia/Kathmandu"];
const meta: Meta<Args> = {
  title: "Elements/Date",
  component: "tp-date",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    input: { control: { type: "text" }, description: "Text content. Empty or invalid → now." },
    format: { control: { type: "select" }, options: FORMATS },
    inputFormat: { name: "input-format", control: { type: "text" } },
    locale: { control: { type: "select" }, options: LOCALES },
    timeZone: { name: "time-zone", control: { type: "select" }, options: ZONES },
    live: { control: { type: "boolean" } },
  },
  args: {
    input: "2024-01-22T14:30:00Z",
    format: "dddd, D MMMM YYYY HH:mm",
    inputFormat: "",
    locale: "",
    timeZone: "",
    live: false,
  },
};

export default meta;

type Story = StoryObj<Args>;

/** Interactive playground. */
export const Playground: Story = {
  render: args => html`
    <tp-date
      format=${args.format}
      input-format=${args.inputFormat}
      locale=${args.locale}
      time-zone=${args.timeZone}
      ?live=${args.live}
      >${args.input}</tp-date
    >
  `,
};

const row = (label: string, content: unknown) => html`
  <tr>
    <th style="text-align: start; font-weight: 500; padding: 0.25rem 1rem 0.25rem 0"><code>${label}</code></th>
    <td>${content}</td>
  </tr>
`;

/** Without input, the current time is shown and ticks at the cadence the format needs. */
export const LiveClock: Story = {
  render: () => html`
    <table style="font-family: system-ui, sans-serif">
      ${row(`format="HH:mm:ss"`, html`<tp-date format="HH:mm:ss"></tp-date>`)}
      ${row(`format="h:mm A"`, html`<tp-date format="h:mm A"></tp-date>`)}
      ${row(`format="ss.SSS"`, html`<tp-date format="ss.SSS"></tp-date>`)}
      ${row(`format="full"`, html`<tp-date format="full"></tp-date>`)}
      ${row(`time-zone="Asia/Tokyo"`, html`<tp-date format="HH:mm:ss Z" time-zone="Asia/Tokyo"></tp-date>`)}
    </table>
  `,
};

/** Presets map to `Intl.DateTimeFormat` styles; `date-style` / `time-style` override each part. */
export const Presets: Story = {
  render: () => html`
    <table style="font-family: system-ui, sans-serif">
      ${["short", "medium", "long", "full"].map(format =>
        row(`format="${format}"`, html`<tp-date format=${format}>2024-01-22T14:30:00</tp-date>`),
      )}
      ${row(`format="long" time-style="none"`, html`<tp-date format="long" time-style="none">2024-01-22</tp-date>`)}
    </table>
  `,
};

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

/** `format="relative"` stays up to date; hover for the full date. */
export const Relative: Story = {
  render: () => html`
    <table style="font-family: system-ui, sans-serif">
      ${[0.2, 3, 90, 60 * 30, -60 * 24 * 3].map(minutes =>
        row(`${minutes} min ago`, html`<tp-date format="relative" datetime=${minutesAgo(minutes)}></tp-date>`),
      )}
    </table>
  `,
};

/** Names and numeric input order follow `locale` or the nearest `lang`. */
export const Localized: Story = {
  render: () => html`
    <table style="font-family: system-ui, sans-serif">
      ${["en-US", "en-GB", "tr", "de", "ja", "ar-EG"].map(lang =>
        row(
          `lang="${lang}"`,
          html`<span lang=${lang}><tp-date format="dddd, D MMMM YYYY">2024-01-22</tp-date> ·
            <tp-date format="full" time-style="none">2024-01-22</tp-date> ·
            <tp-date format="relative" .value=${Date.now() - 3 * 3_600_000}></tp-date></span>`,
        ),
      )}
    </table>
  `,
};

/** `input-format` parses any layout; invalid input falls back to now and sets `[invalid]`. */
export const Parsing: Story = {
  render: () => html`
    <style>
      tp-date[invalid] {
        text-decoration: wavy underline crimson;
      }
    </style>
    <table style="font-family: system-ui, sans-serif">
      ${row(`lang="tr" 22/01/2024`, html`<tp-date lang="tr" format="D MMMM YYYY">22/01/2024</tp-date>`)}
      ${row(`lang="en-US" 01/02/2024`, html`<tp-date lang="en-US" format="D MMMM YYYY">01/02/2024</tp-date>`)}
      ${row(
        `input-format="YYYYMMDD[T]HHmm"`,
        html`<tp-date input-format="YYYYMMDD[T]HHmm" format="DD.MM.YYYY HH:mm">20240122T1430</tp-date>`,
      )}
      ${row(`invalid: 32/13/2024`, html`<tp-date format="DD/MM/YYYY HH:mm:ss">32/13/2024</tp-date>`)}
    </table>
  `,
};
