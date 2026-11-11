import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { afterEach, describe, expect, it } from "vitest";

import { cdnLanguageLoader, languageCdnUrl, setLanguageCdnBaseUrl, SHIKI_LANGS_VERSION } from "./cdn-language-loader";

describe("cdn language loader", () => {
  afterEach(() => {
    setLanguageCdnBaseUrl();
  });

  it("pins the same version as the installed shiki", () => {
    const require = createRequire(import.meta.url);
    const { version } = JSON.parse(readFileSync(require.resolve("shiki/package.json"), "utf8"));

    expect(SHIKI_LANGS_VERSION).toBe(version);
  });

  it("builds jsDelivr URLs by default", () => {
    expect(languageCdnUrl("ts")).toBe(`https://cdn.jsdelivr.net/npm/@shikijs/langs@${SHIKI_LANGS_VERSION}/dist/ts.mjs`);
  });

  it("supports a custom base URL with or without a trailing slash", () => {
    setLanguageCdnBaseUrl("https://example.com/langs");
    expect(languageCdnUrl("go")).toBe("https://example.com/langs/go.mjs");

    setLanguageCdnBaseUrl("https://example.com/langs/");
    expect(languageCdnUrl("go")).toBe("https://example.com/langs/go.mjs");
  });

  it.each(["../evil", "a/b", "https://x", "Ts", "", "-x"])("rejects unsafe name %j without fetching", async name => {
    await expect(cdnLanguageLoader(name)).resolves.toBeUndefined();
  });
});
