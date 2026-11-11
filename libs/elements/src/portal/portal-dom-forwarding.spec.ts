import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PortalElement } from "./portal-element";
import type { PortalOutletElement } from "./portal-outlet-element";
import "./index";

/**
 * Frameworks keep the portal as the parent of the nodes they render and keep
 * mutating it after the nodes moved to the outlet. These calls must neither
 * throw nor leak content back into the (hidden) portal.
 */
describe("<tp-portal> DOM forwarding while projected", () => {
  let portal: PortalElement;
  let outlet: PortalOutletElement;
  const names = (): string[] => portal.projectedNodes.map((n) => (n instanceof Element ? n.id : `#${n.nodeValue}`));

  beforeEach(() => {
    document.body.innerHTML = `
      <tp-portal name="foo"><p id="a"></p><p id="b"></p></tp-portal>
      <tp-portal-outlet name="foo"><i id="own"></i></tp-portal-outlet>
    `;
    portal = document.querySelector("tp-portal")!;
    outlet = document.querySelector("tp-portal-outlet")!;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  const p = (id: string): HTMLElement => Object.assign(document.createElement("p"), { id });

  it("appendChild", () => {
    portal.appendChild(p("c"));
    expect(names()).toEqual(["a", "b", "c"]);
    expect(portal.childNodes.length).toBe(0);
  });

  it("insertBefore a projected sibling and before null", () => {
    portal.insertBefore(p("x"), outlet.querySelector("#b"));
    portal.insertBefore(p("z"), null);
    expect(names()).toEqual(["a", "x", "b", "z"]);
  });

  it("removeChild / replaceChild on projected nodes", () => {
    portal.removeChild(outlet.querySelector("#a")!);
    portal.replaceChild(p("r"), outlet.querySelector("#b")!);
    expect(names()).toEqual(["r"]);
  });

  it("still throws for nodes that are not its children", () => {
    expect(() => portal.removeChild(outlet.querySelector("#own")!)).not.toThrow();
    expect(() => portal.removeChild(document.createElement("p"))).toThrow();
  });

  it("append / prepend / replaceChildren", () => {
    portal.append("t", p("c"));
    portal.prepend(p("first"));
    expect(names()).toEqual(["first", "a", "b", "#t", "c"]);

    portal.replaceChildren(p("only"));
    expect(names()).toEqual(["only"]);
    expect(outlet.querySelector("#own")).not.toBeNull();
  });

  it("textContent get/set", () => {
    portal.textContent = "hello";
    expect(names()).toEqual(["#hello"]);
    expect(portal.textContent).toBe("hello");

    portal.textContent = "";
    expect(names()).toEqual([]);
  });

  it("innerHTML get/set", () => {
    portal.innerHTML = `<p id="h"></p>text`;
    expect(names()).toEqual(["h", "#text"]);
    expect(portal.innerHTML).toBe(`<p id="h"></p>text`);
    expect(outlet.querySelector("#own")).not.toBeNull();
  });

  it("behaves natively when not projected", () => {
    outlet.remove();
    portal.textContent = "plain";
    expect(portal.childNodes.length).toBe(1);
    expect(portal.innerHTML).toBe("plain");
  });
});
