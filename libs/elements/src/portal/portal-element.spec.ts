import { afterEach, describe, expect, it } from "vitest";

import { PortalElement } from "./portal-element";
import { PortalOutletElement } from "./portal-outlet-element";

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));
const $ = <T extends Element>(selector: string): T => document.querySelector(selector) as T;
/** Element/text content of an outlet, ignoring the range markers. */
const contentOf = (el: Node): string[] =>
  Array.from(el.childNodes)
    .filter((n) => n.nodeType !== Node.COMMENT_NODE && !(n.nodeType === Node.TEXT_NODE && !n.nodeValue?.trim()))
    .map((n) => (n instanceof Element ? n.tagName.toLowerCase() : n.nodeValue!.trim()));

describe("<tp-portal> / <tp-portal-outlet>", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("registers both custom elements", () => {
    expect(customElements.get("tp-portal")).toBe(PortalElement);
    expect(customElements.get("tp-portal-outlet")).toBe(PortalOutletElement);
  });

  it("moves the same nodes (not clones) into the outlet, keeping listeners", () => {
    document.body.innerHTML = `
      <tp-portal name="foo">Foo Text<section>inner</section></tp-portal>
      <tp-portal-outlet name="foo"></tp-portal-outlet>
    `;
    const portal = $<PortalElement>("tp-portal");
    const outlet = $<PortalOutletElement>("tp-portal-outlet");
    const section = outlet.querySelector("section")!;

    expect(contentOf(outlet)).toEqual(["Foo Text", "section"]);
    expect(portal.childNodes.length).toBe(0);
    expect(portal.outlet).toBe(outlet);
    expect(portal.hasAttribute("projected")).toBe(true);
    expect(outlet.hasAttribute("active")).toBe(true);

    let clicks = 0;
    section.addEventListener("click", () => clicks++);
    section.click();
    expect(clicks).toBe(1);
  });

  it("projects when the outlet connects after the portal", () => {
    document.body.innerHTML = `<tp-portal name="foo"><b>x</b></tp-portal>`;
    const portal = $<PortalElement>("tp-portal");
    expect(portal.querySelector("b")).not.toBeNull();

    const outlet = document.createElement("tp-portal-outlet");
    outlet.name = "foo";
    document.body.append(outlet);
    expect(outlet.querySelector("b")).not.toBeNull();
  });

  it("brings content back when the outlet disconnects", () => {
    document.body.innerHTML = `
      <tp-portal name="foo"><b>x</b></tp-portal>
      <tp-portal-outlet name="foo"></tp-portal-outlet>
    `;
    const portal = $<PortalElement>("tp-portal");
    const outlet = $<PortalOutletElement>("tp-portal-outlet");
    outlet.remove();

    expect(portal.querySelector("b")).not.toBeNull();
    expect(outlet.childNodes.length).toBe(0);
    expect(portal.hasAttribute("projected")).toBe(false);
    expect(outlet.hasAttribute("active")).toBe(false);
  });

  it("takes its content with it when the portal disconnects", () => {
    document.body.innerHTML = `
      <div id="host"><tp-portal name="foo"><b>x</b></tp-portal></div>
      <tp-portal-outlet name="foo"></tp-portal-outlet>
    `;
    const portal = $<PortalElement>("tp-portal");
    const outlet = $<PortalOutletElement>("tp-portal-outlet");
    $("#host").remove();

    expect(outlet.childNodes.length).toBe(0);
    expect(portal.querySelector("b")).not.toBeNull();
  });

  it("re-projects when the portal is moved elsewhere", () => {
    document.body.innerHTML = `
      <div id="a"><tp-portal name="foo"><b>x</b></tp-portal></div>
      <div id="b"></div>
      <tp-portal-outlet name="foo"></tp-portal-outlet>
    `;
    $("#b").append($("tp-portal"));
    expect($("tp-portal-outlet").querySelector("b")).not.toBeNull();
  });

  it("follows name changes on both sides", () => {
    document.body.innerHTML = `
      <tp-portal name="a"><b>x</b></tp-portal>
      <tp-portal-outlet name="a" id="oa"></tp-portal-outlet>
      <tp-portal-outlet name="b" id="ob"></tp-portal-outlet>
    `;
    const portal = $<PortalElement>("tp-portal");
    portal.name = "b";
    expect($("#ob").querySelector("b")).not.toBeNull();
    expect($("#oa").querySelector("b")).toBeNull();

    $("#oa").setAttribute("name", "b");
    expect($("#oa").querySelector("b")).not.toBeNull();
  });

  it("uses the most recent outlet and falls back to the previous one", () => {
    document.body.innerHTML = `
      <tp-portal name="foo"><b>x</b></tp-portal>
      <tp-portal-outlet name="foo" id="first"></tp-portal-outlet>
    `;
    const second = document.createElement("tp-portal-outlet");
    second.name = "foo";
    document.body.append(second);
    expect(second.querySelector("b")).not.toBeNull();

    second.remove();
    expect($("#first").querySelector("b")).not.toBeNull();
  });

  it("projects several portals into one outlet in connection order, after the outlet's own children", () => {
    document.body.innerHTML = `
      <tp-portal-outlet name="foo"><i>own</i></tp-portal-outlet>
      <tp-portal name="foo"><b>1</b></tp-portal>
      <tp-portal name="foo"><u>2</u></tp-portal>
    `;
    const outlet = $<PortalOutletElement>("tp-portal-outlet");
    expect(contentOf(outlet)).toEqual(["i", "b", "u"]);
    expect(outlet.portals.length).toBe(2);
  });

  it("picks up children added later by the parser or unpatched APIs", async () => {
    document.body.innerHTML = `
      <tp-portal name="foo"></tp-portal>
      <tp-portal-outlet name="foo"></tp-portal-outlet>
    `;
    $("tp-portal").insertAdjacentHTML("beforeend", "<em>late</em>");
    await flush();
    expect($("tp-portal-outlet").querySelector("em")).not.toBeNull();
  });

  it("never projects into an outlet nested inside its own content", () => {
    document.body.innerHTML = `
      <tp-portal name="foo"><tp-portal-outlet name="foo"></tp-portal-outlet></tp-portal>
    `;
    const portal = $<PortalElement>("tp-portal");
    expect(portal.outlet).toBeNull();
  });

  it("projectedNodes reports the content wherever it lives", () => {
    document.body.innerHTML = `<tp-portal name="foo"><b>x</b></tp-portal>`;
    const portal = $<PortalElement>("tp-portal");
    expect(portal.projectedNodes.map((n) => n.nodeName)).toEqual(["B"]);

    document.body.append(Object.assign(document.createElement("tp-portal-outlet"), { name: "foo" }));
    expect(portal.projectedNodes.map((n) => n.nodeName)).toEqual(["B"]);
  });
});
