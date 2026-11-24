import type { Mermaid } from "mermaid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setMermaidLoader } from "./loader";
import { MermaidElement } from "./mermaid-element";

type Render = Mermaid["render"];
type Initialize = Mermaid["initialize"];

const render = vi.fn<Parameters<Render>, ReturnType<Render>>();
const initialize = vi.fn<Parameters<Initialize>, ReturnType<Initialize>>();

async function mount(markup: string): Promise<MermaidElement> {
  document.body.innerHTML = markup;

  const element = document.querySelector("tp-mermaid") as MermaidElement;

  await element.updateComplete;
  await element.renderComplete;

  return element;
}

const shadow = (element: MermaidElement) => element.shadowRoot!;

describe("<tp-mermaid>", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    render.mockReset();
    initialize.mockReset();
    render.mockImplementation(async (id, text) => ({ svg: `<svg id="${id}"><text>${text.length}</text></svg>`, diagramType: "flowchart-v2" }));
    setMermaidLoader(async () => ({ render, initialize }) as unknown as Mermaid);
    // jsdom has no canvas; colors are passed on as written
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("registers the custom element", () => {
    expect(customElements.get("tp-mermaid")).toBe(MermaidElement);
  });

  it("renders the dedented text content to SVG", async () => {
    const element = await mount(`
      <tp-mermaid>
        flowchart LR
          a --&gt; b
      </tp-mermaid>
    `);

    expect(render).toHaveBeenCalledTimes(1);
    expect(render.mock.calls[0][1]).toBe("flowchart LR\n  a --> b");
    expect(element.status).toBe("rendered");
    expect(element.getAttribute("status")).toBe("rendered");
    expect(shadow(element).querySelector("[part=diagram] svg")).not.toBeNull();
  });

  it("reads a <template> child with -->, <br/> and & as written", async () => {
    const element = await mount(`<tp-mermaid><template>flowchart LR\n  a["x<br/>y & z"] --> b</template></tp-mermaid>`);

    expect(element.source).toBe('flowchart LR\n  a["x<br>y & z"] --> b');
  });

  it("prefers the code property and re-renders when it changes", async () => {
    const element = await mount(`<tp-mermaid>flowchart LR\n  a --&gt; b</tp-mermaid>`);

    element.code = "flowchart TD\n  c --> d";
    await element.updateComplete;
    await element.renderComplete;

    expect(render).toHaveBeenCalledTimes(2);
    expect(render.mock.calls[1][1]).toBe("flowchart TD\n  c --> d");
  });

  it("re-renders when the light DOM changes", async () => {
    const element = await mount(`<tp-mermaid>flowchart LR\n  a --&gt; b</tp-mermaid>`);

    element.textContent = "flowchart LR\n  x --> y";
    await new Promise(resolve => setTimeout(resolve));
    await element.updateComplete;
    await element.renderComplete;

    expect(render.mock.calls.at(-1)?.[1]).toBe("flowchart LR\n  x --> y");
  });

  it("does not render an empty source", async () => {
    const element = await mount(`<tp-mermaid>   </tp-mermaid>`);

    expect(render).not.toHaveBeenCalled();
    expect(element.status).toBe("pending");
  });

  it("initializes Mermaid with the base theme and strict security before each render", async () => {
    await mount(`<tp-mermaid>flowchart LR\n  a --&gt; b</tp-mermaid>`);

    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({ theme: "base", securityLevel: "strict", startOnLoad: false }));
    expect(initialize.mock.invocationCallOrder[0]).toBeLessThan(render.mock.invocationCallOrder[0]);
  });

  it("shows the error and the source when Mermaid fails", async () => {
    render.mockRejectedValueOnce(new Error("Parse error on line 2"));

    const events: CustomEvent[] = [];

    document.addEventListener("tp-mermaid-render", event => events.push(event as CustomEvent), { once: true });

    const element = await mount(`<tp-mermaid>flowchart LR\n  a --&gt;</tp-mermaid>`);

    expect(element.status).toBe("error");
    expect(shadow(element).querySelector("[part=error]")?.textContent).toBe("Parse error on line 2");
    expect(shadow(element).querySelector("[part=source]")?.textContent).toBe("flowchart LR\n  a -->");
    expect(events[0]?.detail).toEqual({ error: "Parse error on line 2" });
  });

  it("fires tp-mermaid-render with the diagram type", async () => {
    const events: CustomEvent[] = [];

    document.addEventListener("tp-mermaid-render", event => events.push(event as CustomEvent), { once: true });
    await mount(`<tp-mermaid>flowchart LR\n  a --&gt; b</tp-mermaid>`);

    expect(events[0]?.detail).toEqual({ diagramType: "flowchart-v2" });
    expect(events[0]?.bubbles).toBe(true);
    expect(events[0]?.composed).toBe(true);
  });

  it("drops a superseded render", async () => {
    let resolveFirst!: (value: Awaited<ReturnType<Render>>) => void;

    render.mockImplementationOnce(() => new Promise(resolve => (resolveFirst = resolve)));
    document.body.innerHTML = `<tp-mermaid>flowchart LR\n  old --&gt; x</tp-mermaid>`;

    const element = document.querySelector("tp-mermaid") as MermaidElement;

    await element.updateComplete;
    element.code = "flowchart LR\n  new --> x";
    await element.updateComplete;
    // Wait until the first render was requested, then let it finish late
    await vi.waitFor(() => expect(resolveFirst).toBeTypeOf("function"));
    resolveFirst({ svg: `<svg class="old"></svg>`, diagramType: "flowchart-v2" });
    await element.renderComplete;

    expect(shadow(element).querySelector("svg.old")).toBeNull();
    expect(element.status).toBe("rendered");
  });

  it("exposes the diagram as one labelled image when label is set", async () => {
    const element = await mount(`<tp-mermaid label="Request flow">flowchart LR\n  a --&gt; b</tp-mermaid>`);
    const diagram = shadow(element).querySelector("[part=diagram]")!;

    expect(diagram.getAttribute("role")).toBe("img");
    expect(diagram.getAttribute("aria-label")).toBe("Request flow");
  });
});
