import { ATTACH_PORTAL, DETACH_PORTAL } from "./internal-props";
import type { PortalElement } from "./portal-element";
import { portalRegistry } from "./portal-registry";
import { injectPortalStyles } from "./styles";

declare global {
  interface HTMLElementTagNameMap {
    /**
     * Render target for `<tp-portal>` elements with the same `name`.
     *
     * Content of every matching portal is appended after the outlet's own
     * children, in the order the portals connected. When several outlets share
     * a name, the most recently connected one is active; if it disconnects,
     * the previous one takes over and the content moves there.
     *
     * The outlet is `display: contents` by default, so projected content lays
     * out as if it were a child of the outlet's parent.
     *
     * @example
     * ```html
     * <tp-portal-outlet name="toolbar"></tp-portal-outlet>
     * ```
     *
     * @attr name - Name that `<tp-portal>` elements target.
     * @attr active - Reflected (read-only) while at least one portal projects here.
     */
    "tp-portal-outlet": PortalOutletElement;
  }
}

export class PortalOutletElement extends HTMLElement {
  static readonly observedAttributes = ["name"];

  readonly #portals = new Set<PortalElement>();
  #registeredName: string | null = null;

  /** Name that `<tp-portal>` elements target. */
  get name(): string {
    return this.getAttribute("name") ?? "";
  }

  set name(value: string) {
    this.setAttribute("name", value);
  }

  /** Portals currently projecting into this outlet, in projection order. */
  get portals(): readonly PortalElement[] {
    return [...this.#portals];
  }

  connectedCallback(): void {
    injectPortalStyles();
    this.#register();
  }

  disconnectedCallback(): void {
    this.#unregister();
  }

  attributeChangedCallback(): void {
    if (!this.isConnected) return;
    this.#unregister();
    this.#register();
  }

  /** @internal */
  [ATTACH_PORTAL](portal: PortalElement): void {
    this.#portals.add(portal);
    this.toggleAttribute("active", true);
  }

  /** @internal */
  [DETACH_PORTAL](portal: PortalElement): void {
    this.#portals.delete(portal);
    this.toggleAttribute("active", this.#portals.size > 0);
  }

  #register(): void {
    const name = this.name;
    if (!name) return;
    this.#registeredName = name;
    portalRegistry.addOutlet(name, this);
  }

  #unregister(): void {
    if (this.#registeredName === null) return;
    const name = this.#registeredName;
    this.#registeredName = null;
    portalRegistry.removeOutlet(name, this);
  }
}

if (!customElements.get("tp-portal-outlet")) customElements.define("tp-portal-outlet", PortalOutletElement);
