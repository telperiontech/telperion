import { afterEach, describe, expect, it, vi } from "vitest";

import { copyText } from "./copy";

describe("copyText", () => {
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

  afterEach(() => {
    if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
    else delete (navigator as { clipboard?: unknown }).clipboard;
    vi.restoreAllMocks();
  });

  function mockClipboard(writeText: (text: string) => Promise<void>) {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  }

  it("uses the async Clipboard API", async () => {
    const writeText = vi.fn(async () => undefined);
    mockClipboard(writeText);

    await expect(copyText("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to execCommand when the Clipboard API rejects", async () => {
    mockClipboard(async () => {
      throw new Error("denied");
    });

    const execCommand = vi.fn(() => true);
    (document as { execCommand?: unknown }).execCommand = execCommand;

    await expect(copyText("hello")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("reports failure when nothing works", async () => {
    mockClipboard(async () => {
      throw new Error("denied");
    });
    (document as { execCommand?: unknown }).execCommand = () => false;

    await expect(copyText("hello")).resolves.toBe(false);
  });
});
