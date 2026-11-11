import { afterEach, describe, expect, it } from "vitest";

import "./portal-element";
import "./portal-outlet-element";
import type { PortalOutletElement } from "./portal-outlet-element";
import { PortalOutletFallbackElement } from "./portal-outlet-fallback-element";

const $ = <T extends Element>(selector: string): T => document.querySelector(selector) as T;
/** The selector the injected stylesheet hides fallbacks with (jsdom doesn't apply adopted sheets). */
const HIDDEN = "tp-portal-outlet[active] > tp-portal-outlet-fallback";

describe("<tp-portal-outlet-fallback>", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("registers the custom element", () => {
    expect(customElements.get("tp-portal-outlet-fallback")).toBe(PortalOutletFallbackElement);
  });

  it("is shown while no portal projects into its outlet", () => {
    document.body.innerHTML = `
      <tp-portal-outlet name="foo">
        <tp-portal-outlet-fallback>Default</tp-portal-outlet-fallback>
      </tp-portal-outlet>
    `;
    const fallback = $<PortalOutletFallbackElement>("tp-portal-outlet-fallback");

    expect(fallback.shown).toBe(true);
    expect(fallback.matches(HIDDEN)).toBe(false);
  });

  it("is hidden while a portal projects, and shown again when it leaves", () => {
    document.body.innerHTML = `
      <tp-portal-outlet name="foo">
        <tp-portal-outlet-fallback>Default</tp-portal-outlet-fallback>
      </tp-portal-outlet>
      <tp-portal name="foo"><b>x</b></tp-portal>
    `;
    const fallback = $<PortalOutletFallbackElement>("tp-portal-outlet-fallback");

    expect(fallback.shown).toBe(false);
    expect(fallback.matches(HIDDEN)).toBe(true);

    $("tp-portal").remove();
    expect(fallback.shown).toBe(true);
    expect(fallback.matches(HIDDEN)).toBe(false);
  });

  it("stays in place while projected content is appended after it", () => {
    document.body.innerHTML = `
      <tp-portal-outlet name="foo">
        <tp-portal-outlet-fallback>Default</tp-portal-outlet-fallback>
      </tp-portal-outlet>
      <tp-portal name="foo"><b>x</b></tp-portal>
    `;
    const outlet = $<PortalOutletElement>("tp-portal-outlet");
    const elements = Array.from(outlet.children, (el) => el.localName);

    expect(elements).toEqual(["tp-portal-outlet-fallback", "b"]);
  });

  it("follows the outlet when it is renamed", () => {
    document.body.innerHTML = `
      <tp-portal-outlet name="foo">
        <tp-portal-outlet-fallback>Default</tp-portal-outlet-fallback>
      </tp-portal-outlet>
      <tp-portal name="foo"><b>x</b></tp-portal>
    `;
    const outlet = $<PortalOutletElement>("tp-portal-outlet");
    const fallback = $<PortalOutletFallbackElement>("tp-portal-outlet-fallback");

    outlet.name = "bar";
    expect(fallback.shown).toBe(true);

    outlet.name = "foo";
    expect(fallback.shown).toBe(false);
  });

  it("only applies as a direct child of an outlet", () => {
    document.body.innerHTML = `
      <tp-portal-outlet name="foo">
        <div><tp-portal-outlet-fallback>Nested</tp-portal-outlet-fallback></div>
      </tp-portal-outlet>
      <tp-portal name="foo"><b>x</b></tp-portal>
      <tp-portal-outlet-fallback id="orphan">Orphan</tp-portal-outlet-fallback>
    `;
    const nested = $<PortalOutletFallbackElement>("div > tp-portal-outlet-fallback");

    expect(nested.shown).toBe(false);
    expect(nested.matches(HIDDEN)).toBe(false);
    expect($<PortalOutletFallbackElement>("#orphan").shown).toBe(false);
  });
});
