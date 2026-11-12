import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DateElement } from "./date-element";

const NOW = new Date("2024-06-15T09:00:00.000Z");

async function mount(markup: string): Promise<DateElement> {
  document.body.innerHTML = markup;

  const element = document.querySelector("tp-date") as DateElement;

  await element.updateComplete;

  return element;
}

const time = (element: DateElement) => element.shadowRoot!.querySelector("time")!;
const text = (element: DateElement) => time(element).textContent;

describe("<tp-date>", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("registers the custom element", () => {
    expect(customElements.get("tp-date")).toBe(DateElement);
  });

  it("renders the text content with a pattern into a <time>", async () => {
    const element = await mount(`<tp-date format="DD MMMM YYYY" locale="en" time-zone="UTC">2024-01-22</tp-date>`);

    expect(text(element)).toBe("22 January 2024");
    expect(time(element).getAttribute("datetime")).toBe("2024-01-22T00:00:00.000Z");
    expect(time(element).getAttribute("part")).toBe("time");
  });

  it("parses numeric text in the order of the nearest lang", async () => {
    const element = await mount(
      `<div lang="tr"><tp-date format="D MMMM YYYY" time-zone="UTC">22/01/2024</tp-date></div>`,
    );

    expect(text(element)).toBe("22 Ocak 2024");
  });

  it("uses input-format, then datetime, then value with increasing priority", async () => {
    const element = await mount(
      `<tp-date format="YYYY-MM-DD" input-format="DD|MM|YYYY" time-zone="UTC">22|01|2024</tp-date>`,
    );
    expect(text(element)).toBe("2024-01-22");

    element.inputFormat = "";
    element.datetime = "2023-03-04";
    await element.updateComplete;
    expect(text(element)).toBe("2023-03-04");

    element.value = Date.UTC(2020, 1, 29);
    await element.updateComplete;
    expect(text(element)).toBe("2020-02-29");
  });

  it("re-renders when the text content changes", async () => {
    const element = await mount(`<tp-date format="YYYY" time-zone="UTC">2024-01-22</tp-date>`);

    element.textContent = "1999-12-31";
    await Promise.resolve();
    await element.updateComplete;

    expect(text(element)).toBe("1999");
  });

  it("falls back to now for empty input without flagging it", async () => {
    const element = await mount(`<tp-date format="YYYY-MM-DD HH:mm" time-zone="UTC"></tp-date>`);

    expect(text(element)).toBe("2024-06-15 09:00");
    expect(element.invalid).toBe(false);
  });

  it("falls back to now for invalid input, flags it and fires tp-date-invalid once", async () => {
    const listener = vi.fn();
    document.addEventListener("tp-date-invalid", listener);

    const element = await mount(`<tp-date format="YYYY-MM-DD" time-zone="UTC">32/13/2024</tp-date>`);

    expect(text(element)).toBe("2024-06-15");
    expect(element.hasAttribute("invalid")).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail).toEqual({ input: "32/13/2024" });

    element.locale = "en-US";
    await element.updateComplete;
    expect(listener).toHaveBeenCalledTimes(1);

    element.textContent = "2024-01-01";
    await Promise.resolve();
    await element.updateComplete;
    expect(element.hasAttribute("invalid")).toBe(false);

    document.removeEventListener("tp-date-invalid", listener);
  });

  it("ticks a live clock on second boundaries", async () => {
    vi.setSystemTime(new Date("2024-06-15T09:00:00.600Z"));

    const element = await mount(`<tp-date format="HH:mm:ss" time-zone="UTC"></tp-date>`);
    expect(text(element)).toBe("09:00:00");

    await vi.advanceTimersByTimeAsync(400);
    expect(text(element)).toBe("09:00:01");

    await vi.advanceTimersByTimeAsync(1000);
    expect(text(element)).toBe("09:00:02");
  });

  it("does not tick a fixed date in an absolute format", async () => {
    await mount(`<tp-date format="HH:mm:ss">2024-01-22T10:00:00Z</tp-date>`);

    expect(vi.getTimerCount()).toBe(0);
  });

  it("ticks fixed dates when live or relative", async () => {
    const element = await mount(`<tp-date format="relative" locale="en">2024-06-15T08:59:00Z</tp-date>`);

    expect(text(element)).toBe("1 minute ago");
    expect(time(element).title).toContain("2024");

    await vi.advanceTimersByTimeAsync(60_000);
    expect(text(element)).toBe("2 minutes ago");

    element.format = "HH:mm";
    await element.updateComplete;
    expect(vi.getTimerCount()).toBe(0);

    element.live = true;
    await element.updateComplete;
    expect(vi.getTimerCount()).toBe(1);
  });

  it("stops ticking when disconnected and resumes on reconnect", async () => {
    const element = await mount(`<tp-date format="HH:mm:ss"></tp-date>`);
    expect(vi.getTimerCount()).toBe(1);

    element.remove();
    expect(vi.getTimerCount()).toBe(0);

    document.body.append(element);
    await element.updateComplete;
    expect(vi.getTimerCount()).toBe(1);
  });

  it("supports presets with date/time style overrides", async () => {
    const element = await mount(
      `<tp-date locale="en-US" time-zone="UTC" date-style="long" time-style="none">2024-01-22</tp-date>`,
    );

    expect(text(element)).toBe("January 22, 2024");
  });

  it("ignores an unknown time zone", async () => {
    const element = await mount(`<tp-date format="YYYY" time-zone="Mars/Olympus">2024-01-22</tp-date>`);

    expect(text(element)).toBe("2024");
  });
});
