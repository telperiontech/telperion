import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { bundledLanguageLoader } from "./bundled-language-loader";
import { loadLanguage, normalizeLanguage, tokenize } from "./highlighter";
import { setLanguageLoader } from "./language-loader";

describe("highlighter", () => {
  beforeAll(() => {
    setLanguageLoader(bundledLanguageLoader);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes language names", () => {
    expect(normalizeLanguage("  TypeScript ")).toBe("typescript");
    expect(normalizeLanguage(null)).toBe("");
  });

  it("resolves aliases to the canonical language name", async () => {
    await expect(loadLanguage("ts")).resolves.toBe("typescript");
    await expect(loadLanguage("TS")).resolves.toBe("typescript");
  });

  it("loads languages with embedded grammars", async () => {
    await expect(loadLanguage("vue")).resolves.toBe("vue");
  });

  it("treats plain-text names as unhighlighted without warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(loadLanguage("text")).resolves.toBeUndefined();
    await expect(loadLanguage("")).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns once for unknown languages", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(loadLanguage("not-a-language")).resolves.toBeUndefined();
    await expect(loadLanguage("not-a-language")).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("tokenizes into lines of CSS-variable colored tokens", async () => {
    const tokens = await tokenize("const a = 1;\nfoo()", "js");

    expect(tokens).toHaveLength(2);
    expect(tokens![0].map(token => token.content).join("")).toBe("const a = 1;");
    expect(tokens![0][0]).toMatchObject({ content: "const", color: "var(--_tp-code-token-keyword)" });
  });

  it("returns undefined for unknown languages", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(tokenize("x", "nope")).resolves.toBeUndefined();
  });

  it("falls back to plain text when the loader throws", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    setLanguageLoader(async () => {
      throw new Error("offline");
    });

    await expect(tokenize("x", "rust")).resolves.toBeUndefined();

    setLanguageLoader(bundledLanguageLoader);
  });
});
