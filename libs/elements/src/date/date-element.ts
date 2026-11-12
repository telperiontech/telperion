import { html, LitElement, nothing, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";

import { formatDate, formatFull, resolveFormat, type FormatSpec } from "./format";
import { resolveLocale } from "./locale";
import { parseDate } from "./parse";
import { tickPeriod } from "./resolution";
import { dateStyles } from "./styles";
import { subscribe } from "./ticker";
import type { DateInput, DateInvalidEventDetail, DateStyleOverride } from "./types";
import { isValidTimeZone } from "./zone";

/** Lower bound for a custom `interval`, roughly one frame. */
const MIN_INTERVAL = 16;
/** Inputs that change which instant is shown. */
const SOURCE_KEYS = ["value", "datetime", "text", "inputFormat", "locale", "timeZone"] as const;

declare global {
  interface HTMLElementTagNameMap {
    /**
     * A localized date/time. The date comes from the text content (or the
     * `datetime` attribute / `value` property); empty or invalid input shows
     * the current time, kept live.
     *
     * @example
     * ```html
     * <tp-date format="DD MMMM YYYY">2024-01-22</tp-date>
     * <tp-date format="HH:mm:ss"></tp-date>
     * <tp-date format="relative" datetime="2024-01-22T14:30:00Z"></tp-date>
     * ```
     */
    "tp-date": DateElement;
  }

  interface HTMLElementEventMap {
    "tp-date-invalid": CustomEvent<DateInvalidEventDetail>;
  }
}

/**
 * `<tp-date>` &mdash; a localized, optionally live date/time.
 *
 * - **Source** (first non-empty wins): the `value` property, the `datetime`
 *   attribute, the text content. Accepts ISO 8601, epoch milliseconds, or a
 *   numeric date in the locale's order (`22/01/2024` in `tr`); `input-format`
 *   pins a moment-style pattern instead.
 * - **Fallback**: empty or invalid input renders the current time. Invalid
 *   input also sets the `invalid` attribute and fires `tp-date-invalid`.
 * - **Format**: a preset (`short` / `medium` / `long` / `full`, via `Intl`),
 *   `relative`, or a moment-style pattern such as `DD/MM/YYYY HH:mm`.
 * - **Live updates**: the current time and relative dates re-render on a
 *   shared, boundary-aligned clock at the cadence the format needs (each
 *   second for `ss`, each minute for `mm`, ...). Fixed dates in an absolute
 *   format never tick. Ticking pauses while the tab is hidden.
 * - The text content stays in light DOM as the no-JS / pre-upgrade fallback;
 *   the rendered value is a `<time datetime>` in shadow DOM.
 *
 * @element tp-date
 *
 * @attr {string} [format=""] - `short`, `medium` (default), `long`, `full`, `relative`, or a moment-style pattern.
 * @attr {"short" | "medium" | "long" | "full" | "none"} date-style - Presets only. Overrides the date part; `none` omits it.
 * @attr {"short" | "medium" | "long" | "full" | "none"} time-style - Presets only. Overrides the time part; `none` omits it.
 * @attr {string} [input-format=""] - Moment-style pattern used to parse the input, e.g. `DD/MM/YYYY`.
 * @attr {string} [datetime=""] - The date to show. Takes precedence over the text content.
 * @attr {string} [locale=""] - BCP 47 locale. Defaults to the nearest `lang` attribute, then the browser.
 * @attr {string} [time-zone=""] - IANA time zone (`UTC`, `Europe/Istanbul`) for display and for parsing wall times. Defaults to local.
 * @attr {boolean} [live=false] - Forces ticking even for a fixed date in an absolute format.
 * @attr {number} [interval=0] - Custom tick period in ms. `0` derives it from the format.
 * @attr {boolean} invalid - Read-only. Present when the input could not be parsed.
 *
 * @fires tp-date-invalid - When a non-empty input cannot be parsed. `detail: { input }`.
 *
 * @csspart time - The rendered `<time>` element.
 *
 * @cssprop --tp-date-numeric - `font-variant-numeric` of the output. Defaults to `tabular-nums`.
 */
export class DateElement extends LitElement {
  static override styles = dateStyles;

  /** `short`, `medium` (default), `long`, `full`, `relative`, or a moment-style pattern. */
  @property()
  format = "";

  /** Presets only. Overrides the date part; `none` omits it. */
  @property({ attribute: "date-style" })
  dateStyle?: DateStyleOverride;

  /** Presets only. Overrides the time part; `none` omits it. */
  @property({ attribute: "time-style" })
  timeStyle?: DateStyleOverride;

  /** Moment-style pattern used to parse string input. */
  @property({ attribute: "input-format" })
  inputFormat = "";

  /** The date to show as a string. Takes precedence over the text content. */
  @property()
  datetime = "";

  /** BCP 47 locale. Defaults to the nearest `lang` attribute, then the browser. */
  @property()
  locale = "";

  /** IANA time zone. Defaults to the local zone. */
  @property({ attribute: "time-zone" })
  timeZone = "";

  /** Forces ticking even for a fixed date in an absolute format. */
  @property({ type: Boolean, reflect: true })
  live = false;

  /** Custom tick period in ms. `0` derives it from the format. */
  @property({ type: Number })
  interval = 0;

  /** The date as a `Date`, epoch ms or string. Takes precedence over `datetime` and the text content. */
  @property({ attribute: false })
  value?: DateInput;

  /** Read-only. `true` when the input could not be parsed (the current time is shown instead). */
  @property({ type: Boolean, reflect: true })
  invalid = false;

  /** Text content of the light DOM. */
  @state()
  private text = "";

  #fixed?: Date;
  #now = Date.now();
  #observer?: MutationObserver;
  #unsubscribe?: () => void;
  #period = 0;
  #invalidInput?: string;
  #lastInvalid?: string;

  /** The instant currently shown (the parsed input, or the current time). */
  get date(): Date {
    return new Date(this.#fixed?.getTime() ?? this.#now);
  }

  override connectedCallback(): void {
    super.connectedCallback();

    this.#observer ??= new MutationObserver(() => this.#syncText());
    this.#observer.observe(this, { childList: true, characterData: true, subtree: true });
    this.#syncText();
    // Re-subscribe to the ticker after a reconnect.
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#observer?.disconnect();
    this.#setPeriod(0);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    this.#now = Date.now();

    if (SOURCE_KEYS.some(key => changed.has(key as keyof DateElement))) this.#parse();
  }

  protected override render(): unknown {
    const spec = this.#spec();
    const date = this.date;
    const locale = this.#locale();
    const timeZone = this.#timeZone();

    return html`<time
      part="time"
      datetime=${date.toISOString()}
      title=${spec.kind === "relative" ? formatFull(date, locale, timeZone) : nothing}
      >${formatDate(date, spec, { locale, timeZone, now: this.#now })}</time
    >`;
  }

  protected override updated(): void {
    this.#schedule();

    if (this.#invalidInput !== undefined) {
      const input = this.#invalidInput;

      this.#invalidInput = undefined;
      this.dispatchEvent(
        new CustomEvent<DateInvalidEventDetail>("tp-date-invalid", { bubbles: true, composed: true, detail: { input } }),
      );
    }
  }

  #parse(): void {
    const input = this.value ?? (this.datetime.trim() || this.text);
    const fixed = parseDate(input, {
      inputFormat: this.inputFormat,
      locale: this.#locale(),
      timeZone: this.#timeZone(),
      now: this.#now,
    });
    const empty = input === null || input === undefined || (typeof input === "string" && !input.trim());
    const invalid = !fixed && !empty;
    const key = String(input);

    // Fire once per distinct invalid input, not on every re-parse.
    if (invalid && key !== this.#lastInvalid) this.#invalidInput = key;

    this.#lastInvalid = invalid ? key : undefined;
    this.#fixed = fixed;
    this.invalid = invalid;
  }

  #spec(): FormatSpec {
    return resolveFormat(this.format, this.dateStyle, this.timeStyle);
  }

  #locale(): string | undefined {
    return resolveLocale(this, this.locale);
  }

  #timeZone(): string | undefined {
    const zone = this.timeZone.trim();

    return zone && isValidTimeZone(zone) ? zone : undefined;
  }

  /** Subscribes to the shared ticker at the cadence the current format needs, or not at all. */
  #schedule(): void {
    const spec = this.#spec();
    const live = this.live || !this.#fixed || spec.kind === "relative";

    if (!this.isConnected || !live) return this.#setPeriod(0);

    const interval = Number(this.interval);

    this.#setPeriod(interval > 0 ? Math.max(interval, MIN_INTERVAL) : tickPeriod(spec, this.date, this.#now));
  }

  #setPeriod(period: number): void {
    if (period === this.#period) return;

    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#period = period;

    if (period) this.#unsubscribe = subscribe(period, () => this.requestUpdate());
  }

  #syncText(): void {
    this.text = (this.textContent ?? "").trim();
  }
}

if (!customElements.get("tp-date")) customElements.define("tp-date", DateElement);
