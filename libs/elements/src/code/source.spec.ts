import { describe, expect, it } from "vitest";

import { dedent, normalizeSource, readSource } from "./source";

describe("dedent", () => {
  it("strips the common indentation and surrounding blank lines", () => {
    const input = "\n\n    const a = 1;\n      nested();\n    done();\n  \n";

    expect(dedent(input)).toBe("const a = 1;\n  nested();\ndone();");
  });

  it("ignores blank lines when measuring indentation", () => {
    expect(dedent("    a\n\n    b")).toBe("a\n\nb");
  });

  it("treats tabs as indentation", () => {
    expect(dedent("\t\ta\n\t\t\tb")).toBe("a\n\tb");
  });

  it("returns an empty string for blank input", () => {
    expect(dedent("  \n \n")).toBe("");
  });
});

describe("normalizeSource", () => {
  it("normalizes CRLF line endings", () => {
    expect(normalizeSource("a\r\nb\rc", "block")).toBe("a\nb\nc");
  });

  it("trims inline sources", () => {
    expect(normalizeSource("  const a = 1;  \n", "inline")).toBe("const a = 1;");
  });

  it("dedents block sources", () => {
    expect(normalizeSource("\n  a\n    b\n", "block")).toBe("a\n  b");
  });
});

describe("readSource", () => {
  it("reads the text content", () => {
    const host = document.createElement("div");
    host.innerHTML = "a &lt; b <b>bold</b>";

    expect(readSource(host)).toBe("a < b bold");
  });

  it("prefers a direct <template> child and keeps its markup", () => {
    const host = document.createElement("div");
    host.innerHTML = `<template><div class="x">a &amp; b</div></template>`;

    expect(readSource(host)).toBe(`<div class="x">a &amp; b</div>`);
  });

  it("ignores nested (non-direct) templates", () => {
    const host = document.createElement("div");
    host.innerHTML = `<span>text<template><i>x</i></template></span>`;

    expect(readSource(host)).toBe("text");
  });
});
