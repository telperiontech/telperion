import { injectPortalStyles } from "./styles";

declare global {
  interface HTMLElementTagNameMap {
    /**
     * Default content of a `<tp-portal-outlet>`: shown while no `<tp-portal>`
     * projects into the outlet, hidden as soon as one does.
     *
     * Must be a **direct child** of the outlet. It is `display: contents` by
     * default, so its children lay out as children of the outlet's parent.
     * Visibility follows the outlet's `active` attribute through CSS, so
     * frameworks can keep rendering inside the fallback.
     *
     * @example
     * ```html
     * <tp-portal-outlet name="toolbar">
     *   <tp-portal-outlet-fallback>Nothing to do here</tp-portal-outlet-fallback>
     * </tp-portal-outlet>
     * ```
     */
    "tp-portal-outlet-fallback": PortalOutletFallbackElement;
  }
}

export class PortalOutletFallbackElement extends HTMLElement {
  /** Whether the fallback is currently shown: it's in an outlet no portal projects into. */
  get shown(): boolean {
    const parent = this.parentElement;
    return parent?.localName === "tp-portal-outlet" && !parent.hasAttribute("active");
  }

  connectedCallback(): void {
    injectPortalStyles();
  }
}

if (!customElements.get("tp-portal-outlet-fallback")) customElements.define("tp-portal-outlet-fallback", PortalOutletFallbackElement);
