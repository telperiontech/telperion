import { describe, expect, it } from "vitest";

import { tokenize } from "./tokens";

describe("tokenize", () => {
  it("splits tokens greedily and keeps literals", () => {
    expect(tokenize("DD/MM/YYYY HH:mm")).toEqual([
      { token: "DD" },
      { literal: "/" },
      { token: "MM" },
      { literal: "/" },
      { token: "YYYY" },
      { literal: " " },
      { token: "HH" },
      { literal: ":" },
      { token: "mm" },
    ]);
  });

  it("prefers the longest token", () => {
    expect(tokenize("MMMMdddd")).toEqual([{ token: "MMMM" }, { token: "dddd" }]);
  });

  it("treats [bracketed] text as literal", () => {
    expect(tokenize("[Today is] dddd")).toEqual([{ literal: "Today is " }, { token: "dddd" }]);
  });

  it("keeps an unclosed bracket as a literal character", () => {
    expect(tokenize("[YYYY")).toEqual([{ literal: "[" }, { token: "YYYY" }]);
  });
});
