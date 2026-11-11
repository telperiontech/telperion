import { hasNativeMoveBefore, nativeMove, serializeNodes } from "./dom-ops";
import { ATTACH_PORTAL, DETACH_PORTAL, SYNC_PORTAL } from "./internal-props";
import type { PortalOutletElement } from "./portal-outlet-element";
import { portalRegistry } from "./portal-registry";
import { Projection } from "./projection";
import { injectPortalStyles } from "./styles";

declare global {
  interface HTMLElementTagNameMap {
    /**
     * Renders its children inside the `<tp-portal-outlet>` with the same
     * `name`, wherever that outlet is in the document.
     *
     * The child **nodes themselves** are moved (not cloned), so event
     * listeners, element state and framework bindings stay intact. While no
     * matching outlet is connected the children stay inside the portal, which
     * is `display: none` by default.
     *
     * Framework-safe: frameworks (React, Angular, Vue, Lit, …) keep calling
     * `appendChild` / `insertBefore` / `removeChild` / `replaceChild` /
     * `textContent` / `innerHTML` on the portal; while projected, those calls
     * are forwarded to the outlet, so no "node is not a child of this node"
     * errors are thrown.
     *
     * Uses the state-preserving `moveBefore()` when the browser supports it
     * (focus, iframes, CSS animations survive projection).
     *
     * @example
     * ```html
     * <tp-portal name="toolbar">
     *   <button>Save</button>
     * </tp-portal>
     *
     * <header>
     *   <tp-portal-outlet name="toolbar"></tp-portal-outlet>
     * </header>
     * ```
     *
     * @attr name - Outlet name to project into.
     * @attr projected - Reflected (read-only) while the content is in an outlet.
     */
    "tp-portal": PortalElement;
  }
}

export class PortalElement extends HTMLElement {
  static readonly observedAttributes = ["name"];

  readonly #projection = new Projection();
  readonly #observer = new MutationObserver(() => this.#projection.pull(this));
  #outlet: PortalOutletElement | null = null;
  #registeredName: string | null = null;

  /** Outlet name to project into. */
  get name(): string {
    return this.getAttribute("name") ?? "";
  }

  set name(value: string) {
    this.setAttribute("name", value);
  }

  /** The outlet currently hosting this portal's content, if any. */
  get outlet(): PortalOutletElement | null {
    return this.#outlet;
  }

  /** The portal's content nodes, wherever they currently live. */
  get projectedNodes(): Node[] {
    return this.#projection.active ? this.#projection.nodes() : Array.from(this.childNodes);
  }

  connectedCallback(): void {
    injectPortalStyles();
    // Catches children added behind our back (HTML parser, insertAdjacent*, …).
    this.#observer.observe(this, { childList: true });
    this.#register();
  }

  disconnectedCallback(): void {
    this.#unregister();
    this.#observer.disconnect();
  }

  attributeChangedCallback(): void {
    if (!this.isConnected) return;
    this.#unregister();
    this.#register();
  }

  /** @internal */
  [SYNC_PORTAL](): void {
    const next = this.#registeredName === null ? null : portalRegistry.outletFor(this.#registeredName);
    if (next === this.#outlet) return;
    this.#detach();
    // Never project into an outlet nested in our own content (cycle).
    if (next && !this.contains(next)) this.#attach(next);
  }

  // -- Registration ---------------------------------------------------------

  #register(): void {
    const name = this.name;
    if (!name) return;
    this.#registeredName = name;
    portalRegistry.addPortal(name, this);
  }

  /** Unregisters and brings the content home (so it leaves the document with us). */
  #unregister(): void {
    if (this.#registeredName !== null) {
      portalRegistry.removePortal(this.#registeredName, this);
      this.#registeredName = null;
    }
    this.#detach();
  }

  #attach(outlet: PortalOutletElement): void {
    this.#outlet = outlet;
    this.#projection.open(outlet, this);
    outlet[ATTACH_PORTAL](this);
    this.toggleAttribute("projected", true);
  }

  #detach(): void {
    const outlet = this.#outlet;
    if (!outlet) return;
    this.#outlet = null;
    this.#projection.close(this);
    outlet[DETACH_PORTAL](this);
    this.toggleAttribute("projected", false);
  }

  // -- Forwarded DOM mutations ----------------------------------------------
  // Frameworks hold a reference to the portal as the *parent* of the nodes
  // they render. While projected, those nodes live in the outlet, so the
  // native methods would throw; forward them into the projected range.

  /** @internal Forwarded to the outlet while projected. */
  override appendChild<T extends Node>(node: T): T {
    if (!this.#projection.active) return super.appendChild(node);
    this.#projection.insert(node, null);
    return node;
  }

  /** @internal Forwarded to the outlet while projected. */
  override insertBefore<T extends Node>(node: T, ref: Node | null): T {
    if (!this.#projection.active || !this.#projection.owns(ref)) return super.insertBefore(node, ref);
    this.#projection.insert(node, ref);
    return node;
  }

  /** @internal Forwarded to the outlet while projected. */
  override removeChild<T extends Node>(child: T): T {
    if (!this.#projection.active || !this.#projection.owns(child)) return super.removeChild(child);
    this.#projection.remove(child);
    return child;
  }

  /** @internal Forwarded to the outlet while projected. */
  override replaceChild<T extends Node>(next: Node, prev: T): T {
    if (!this.#projection.active || !this.#projection.owns(prev)) return super.replaceChild(next, prev);
    this.#projection.replace(next, prev);
    return prev;
  }

  // State-preserving `moveBefore()`, forwarded while projected. Only installed
  // where the browser has it natively, so feature detection stays truthful.
  static {
    if (hasNativeMoveBefore()) {
      Object.defineProperty(this.prototype, "moveBefore", {
        configurable: true,
        writable: true,
        value(this: PortalElement, node: Node, ref: Node | null): void {
          const projected = this.#projection.active && this.#projection.owns(ref);
          const parent = projected ? this.#projection.container! : this;
          nativeMove(parent, node, projected ? this.#projection.refFor(ref) : ref);
        },
      });
    }
  }

  /** @internal Forwarded to the outlet while projected. */
  override append(...nodes: Array<Node | string>): void {
    if (!this.#projection.active) return super.append(...nodes);
    for (const node of toNodes(nodes)) this.#projection.insert(node, null);
  }

  /** @internal Forwarded to the outlet while projected. */
  override prepend(...nodes: Array<Node | string>): void {
    if (!this.#projection.active) return super.prepend(...nodes);
    for (const node of toNodes(nodes).reverse()) this.#projection.prepend(node);
  }

  /** @internal Forwarded to the outlet while projected. */
  override replaceChildren(...nodes: Array<Node | string>): void {
    if (!this.#projection.active) return super.replaceChildren(...nodes);
    this.#projection.clear();
    this.append(...nodes);
  }

  /** @internal Forwarded to the outlet while projected. */
  override get textContent(): string {
    if (!this.#projection.active) return super.textContent;
    return this.#projection
      .nodes()
      .map((n) => (n.nodeType === Node.COMMENT_NODE ? "" : (n.textContent ?? "")))
      .join("");
  }

  /** @internal */
  override set textContent(value: string | null) {
    if (!this.#projection.active) {
      super.textContent = value;
      return;
    }
    this.#projection.clear();
    if (value) this.#projection.insert(document.createTextNode(value), null);
  }

  /** @internal Forwarded to the outlet while projected. */
  override get innerHTML(): string {
    return this.#projection.active ? serializeNodes(this.#projection.nodes()) : super.innerHTML;
  }

  /** @internal */
  override set innerHTML(value: string) {
    if (!this.#projection.active) {
      super.innerHTML = value;
      return;
    }
    this.#projection.clear();
    super.innerHTML = value;
    this.#projection.pull(this);
  }
}

function toNodes(nodes: Array<Node | string>): Node[] {
  return nodes.map((n) => (typeof n === "string" ? document.createTextNode(n) : n));
}

if (!customElements.get("tp-portal")) customElements.define("tp-portal", PortalElement);
