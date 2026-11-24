import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { afterEach, describe, expect, it } from "vitest";

import { MERMAID_VERSION, mermaidCdnUrl, setMermaidCdnUrl } from "./cdn-mermaid-loader";

describe("cdn mermaid loader", () => {
  afterEach(() => {
    setMermaidCdnUrl();
  });

  it("pins the same version as the installed mermaid", () => {
    const require = createRequire(import.meta.url);
    const { version } = JSON.parse(readFileSync(require.resolve("mermaid/package.json"), "utf8"));

    expect(MERMAID_VERSION).toBe(version);
  });

  it("imports the ESM build from jsDelivr by default", () => {
    expect(mermaidCdnUrl()).toBe(`https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.esm.min.mjs`);
  });

  it("supports a custom URL", () => {
    setMermaidCdnUrl("https://example.com/mermaid.mjs");
    expect(mermaidCdnUrl()).toBe("https://example.com/mermaid.mjs");
  });
});
