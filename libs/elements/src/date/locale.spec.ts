import { afterEach, describe, expect, it } from "vitest";

import { resolveLocale } from "./locale";

describe("resolveLocale", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("prefers the explicit locale, canonicalized", () => {
    document.body.innerHTML = `<div lang="tr"><span></span></div>`;

    expect(resolveLocale(document.querySelector("span")!, "en-us")).toBe("en-US");
  });

  it("falls back to the nearest lang, across shadow roots", () => {
    document.body.innerHTML = `<div lang="tr"><section></section></div>`;

    const shadow = document.querySelector("section")!.attachShadow({ mode: "open" });
    shadow.innerHTML = `<span></span>`;

    expect(resolveLocale(shadow.querySelector("span")!, "")).toBe("tr");
  });

  it("skips invalid tags and returns undefined without any lang", () => {
    document.body.innerHTML = `<span></span>`;

    expect(resolveLocale(document.querySelector("span")!, "not a locale!")).toBeUndefined();
  });
});
