import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { subscribe } from "./ticker";

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("ticker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-22T12:00:00.700Z"));
  });

  afterEach(() => {
    setVisibility("visible");
    vi.useRealTimers();
  });

  it("ticks on period boundaries, not relative to subscribe time", () => {
    const listener = vi.fn();
    const stop = subscribe(1000, listener);

    vi.advanceTimersByTime(299);
    expect(listener).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(listener).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2000);
    expect(listener).toHaveBeenCalledTimes(3);

    stop();
    vi.advanceTimersByTime(5000);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("shares one timer per period", () => {
    const a = vi.fn();
    const b = vi.fn();
    const stops = [subscribe(1000, a), subscribe(1000, b)];

    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(300);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    stops.forEach(stop => stop());
    expect(vi.getTimerCount()).toBe(0);
  });

  it("pauses while hidden and catches up when visible", () => {
    const listener = vi.fn();
    const stop = subscribe(1000, listener);

    setVisibility("hidden");
    vi.advanceTimersByTime(10_000);
    expect(listener).not.toHaveBeenCalled();

    setVisibility("visible");
    expect(listener).toHaveBeenCalledTimes(1);

    stop();
  });
});
