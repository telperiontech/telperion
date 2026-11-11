import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CodeElement } from "./code-element";

async function mount(markup: string): Promise<CodeElement> {
  document.body.innerHTML = markup;

  const element = document.querySelector("tp-code") as CodeElement;

  await element.updateComplete;
  await element.highlightComplete;
  await element.updateComplete;

  return element;
}

const shadow = (element: CodeElement) => element.shadowRoot!;
const lines = (element: CodeElement) => Array.from(shadow(element).querySelectorAll<HTMLElement>(".line"));

describe("<tp-code>", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("registers the custom element", () => {
    expect(customElements.get("tp-code")).toBe(CodeElement);
  });

  describe("inline", () => {
    it("is the default variant and renders a single <code>", async () => {
      const element = await mount(`<p>Run <tp-code language="sh">  pnpm install  </tp-code></p>`);

      expect(element.variant).toBe("inline");
      expect(element.getAttribute("variant")).toBe("inline");
      expect(shadow(element).querySelector("pre")).toBeNull();

      const code = shadow(element).querySelector("code.inline")!;
      expect(code.textContent).toBe("pnpm install");
      expect(code.querySelector("span[style*='--_tp-code-']")).not.toBeNull();
    });

    it("ignores block-only features", async () => {
      const element = await mount(`<tp-code line-numbers copyable highlight-lines="1">x</tp-code>`);

      expect(shadow(element).querySelector("button")).toBeNull();
      expect(shadow(element).querySelector(".numbered")).toBeNull();
    });
  });

  describe("block", () => {
    it("dedents the source and renders one .line per line", async () => {
      const element = await mount(`
        <tp-code variant="block" language="ts">
          const a = 1;
            nested();
        </tp-code>
      `);

      expect(element.source).toBe("const a = 1;\n  nested();");
      expect(lines(element).map(line => line.textContent)).toEqual(["const a = 1;", "  nested();"]);
      expect(shadow(element).querySelector("pre[part='pre'] > code[part='code']")).not.toBeNull();
    });

    it("highlights tokens with CSS-variable colors", async () => {
      const element = await mount(`<tp-code variant="block" language="js">const a = "x";</tp-code>`);
      const keyword = Array.from(lines(element)[0].querySelectorAll("span")).find(span => span.textContent === "const")!;

      expect(keyword.getAttribute("style")).toContain("var(--_tp-code-token-keyword)");
    });

    it("toggles line numbers via a CSS counter starting at line-start", async () => {
      const element = await mount(`<tp-code variant="block" line-numbers line-start="99">a\nb</tp-code>`);
      const pre = shadow(element).querySelector("pre")!;
      const code = shadow(element).querySelector("code")!;

      expect(pre.classList.contains("numbered")).toBe(true);
      expect(code.getAttribute("style")).toContain("counter-reset:tp-code-line 98");
      expect(code.getAttribute("style")).toContain("--_tp-code-gutter:3ch");

      element.lineNumbers = false;
      await element.updateComplete;
      expect(pre.classList.contains("numbered")).toBe(false);
    });

    it("marks highlighted lines using displayed line numbers", async () => {
      const element = await mount(
        `<tp-code variant="block" line-start="10" highlight-lines="11, 13-14">a\nb\nc\nd\ne</tp-code>`,
      );
      const marked = lines(element).map(line => line.hasAttribute("data-highlighted"));
      expect(marked).toEqual([false, true, false, true, true]);
      expect(lines(element)[1].getAttribute("part")).toBe("line highlighted-line");
      expect(lines(element)[0].getAttribute("part")).toBe("line");
    });
  });

  describe("copy button", () => {
    it("is rendered only when copyable", async () => {
      const element = await mount(`<tp-code variant="block">x</tp-code>`);
      expect(shadow(element).querySelector("button")).toBeNull();

      element.copyable = true;
      await element.updateComplete;
      expect(shadow(element).querySelector("button[part='copy-button']")).not.toBeNull();
    });

    it("copies the normalized source and fires tp-code-copy", async () => {
      const writeText = vi.fn(async () => undefined);
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

      const element = await mount(`<tp-code variant="block" copyable>\n    a\n      b\n</tp-code>`);
      const listener = vi.fn();
      element.addEventListener("tp-code-copy", listener);

      await expect(element.copy()).resolves.toBe(true);
      await element.updateComplete;

      expect(writeText).toHaveBeenCalledWith("a\n  b");
      expect(listener.mock.calls[0][0].detail).toEqual({ code: "a\n  b", success: true });

      const button = shadow(element).querySelector("button")!;
      expect(button.hasAttribute("data-copied")).toBe(true);
      expect(button.getAttribute("aria-label")).toBe("Copied");
    });

    it("resets the copied state after a delay", async () => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => undefined } });

      const element = await mount(`<tp-code variant="block" copyable>x</tp-code>`);
      vi.useFakeTimers();

      await element.copy();
      await element.updateComplete;
      expect(shadow(element).querySelector("button")!.hasAttribute("data-copied")).toBe(true);

      vi.advanceTimersByTime(2000);
      await element.updateComplete;
      expect(shadow(element).querySelector("button")!.hasAttribute("data-copied")).toBe(false);
    });
  });

  describe("source", () => {
    it("prefers the code property over children and falls back when cleared", async () => {
      const element = await mount(`<tp-code>from children</tp-code>`);

      element.code = "from property";
      await element.updateComplete;
      expect(element.source).toBe("from property");

      element.code = undefined;
      await element.updateComplete;
      expect(element.source).toBe("from children");
    });

    it("re-highlights when the light DOM changes", async () => {
      const element = await mount(`<tp-code language="js">a</tp-code>`);

      element.textContent = "let b = 2;";
      await new Promise(resolve => setTimeout(resolve));
      await element.updateComplete;
      await element.highlightComplete;
      await element.updateComplete;

      expect(shadow(element).querySelector("code")!.textContent).toBe("let b = 2;");
    });

    it("reads HTML samples from a <template> child", async () => {
      const element = await mount(`<tp-code language="html"><template><div class="a">x</div></template></tp-code>`);

      expect(element.source).toBe(`<div class="a">x</div>`);
      expect(shadow(element).querySelector("code")!.textContent).toBe(`<div class="a">x</div>`);
    });
  });

  describe("highlighting lifecycle", () => {
    it("renders plain text immediately, before the grammar loads", async () => {
      document.body.innerHTML = `<tp-code language="python">print(1)</tp-code>`;

      const element = document.querySelector("tp-code") as CodeElement;
      await element.updateComplete;

      expect(shadow(element).querySelector("code")!.textContent).toBe("print(1)");
    });

    it("fires tp-code-highlight with the outcome", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const events: unknown[] = [];
      document.addEventListener("tp-code-highlight", event => events.push((event as CustomEvent).detail), { once: true });

      await mount(`<tp-code language="nope">x</tp-code>`);

      expect(events).toEqual([{ language: "nope", highlighted: false }]);
    });

    it("renders unknown languages as plain text", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const element = await mount(`<tp-code language="definitely-unknown">a &lt; b</tp-code>`);
      const code = shadow(element).querySelector("code")!;
      expect(code.textContent).toBe("a < b");
      expect(code.querySelector("span")).toBeNull();
    });

    it("drops results of superseded highlight passes", async () => {
      document.body.innerHTML = `<tp-code language="rust">fn main() {}</tp-code>`;

      const element = document.querySelector("tp-code") as CodeElement;
      await element.updateComplete;

      element.language = "text";
      await element.updateComplete;
      await element.highlightComplete;
      await new Promise(resolve => setTimeout(resolve, 50));
      await element.updateComplete;

      expect(shadow(element).querySelector("code")!.querySelector("span")).toBeNull();
    });
  });
});
