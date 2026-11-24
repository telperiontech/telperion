import { html, LitElement, nothing, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { errorMessage, renderDiagram } from "./render";
import { normalizeSource, readSource } from "./source";
import { mermaidStyles } from "./styles";
import { themeConfig } from "./theme";
import type { MermaidRenderEventDetail, MermaidStatus } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    /**
     * A [Mermaid](https://mermaid.js.org) diagram, rendered to SVG. Mermaid
     * loads lazily on the first diagram of the page.
     *
     * Source comes from the element's text content (or a `<template>` child,
     * or the `code` property). Colors are `--tp-mermaid-*` CSS variables.
     *
     * @example
     * ```html
     * <tp-mermaid label="Request flow">
     *   flowchart LR
     *     browser -- HTTPS --> caddy --> app
     * </tp-mermaid>
     * ```
     */
    "tp-mermaid": MermaidElement;
  }

  interface HTMLElementEventMap {
    "tp-mermaid-render": CustomEvent<MermaidRenderEventDetail>;
  }
}

const DARK_SCHEME = "(prefers-color-scheme: dark)";

/**
 * `<tp-mermaid>` &mdash; a [Mermaid](https://mermaid.js.org) diagram rendered to SVG.
 *
 * - **Source**: the element's text content, a direct `<template>` child (write
 *   `-->` and `<br/>` as they are), or the `code` property. It is dedented,
 *   and light-DOM changes re-render it.
 * - **Lazy**: Mermaid is imported on the first render of the page, so
 *   registering the element costs next to nothing.
 * - **Theming**: Mermaid's `base` theme, colored from `--tp-mermaid-*`
 *   variables (defaults from the shared `--tp-color-*` palette) and the
 *   element's font. Mermaid bakes colors into the SVG: call `refresh()` after
 *   changing them. A change of `prefers-color-scheme` re-renders on its own.
 * - **Safe**: Mermaid runs with `securityLevel: "strict"`.
 * - **Errors**: a source that does not parse shows the message and the source.
 *
 * @element tp-mermaid
 *
 * @attr {string} [label=""] - Accessible name of the diagram. When set, the diagram is exposed as one image with this name.
 * @attr {"pending" | "rendered" | "error"} status - Read-only. Render state, for styling.
 *
 * @fires tp-mermaid-render - After each render pass. `detail: { diagramType }` on success, `detail: { error }` on failure.
 *
 * @csspart diagram - Wrapper of the rendered SVG.
 * @csspart error - The error message.
 * @csspart source - The source, shown when rendering failed.
 *
 * @cssprop --tp-mermaid-foreground - Text color. Defaults to `--tp-color-contrast`.
 * @cssprop --tp-mermaid-background - The surface the diagram sits on; used for edge labels and mixed into the defaults. Defaults to `--tp-color-white`.
 * @cssprop --tp-mermaid-accent - Accent the node colors derive from. Defaults to `--tp-color-primary`.
 * @cssprop --tp-mermaid-node-background - Node fill. Defaults to 10% accent.
 * @cssprop --tp-mermaid-node-border - Node border. Defaults to 55% accent.
 * @cssprop --tp-mermaid-line - Edges and arrows. Defaults to 60% foreground.
 * @cssprop --tp-mermaid-cluster-background - Subgraph fill. Defaults to 4% foreground.
 * @cssprop --tp-mermaid-cluster-border - Subgraph border. Defaults to 25% foreground.
 * @cssprop --tp-mermaid-note-background - Note fill. Defaults to 18% `--tp-color-warning`.
 * @cssprop --tp-mermaid-font-family - Diagram font. Defaults to the inherited font.
 * @cssprop --tp-mermaid-font-size - Diagram font size. Defaults to the inherited size.
 * @cssprop --tp-mermaid-align - `justify-content` of the diagram. Defaults to `center`.
 */
export class MermaidElement extends LitElement {
  static override styles = mermaidStyles;

  /** Accessible name of the diagram. */
  @property({ reflect: true })
  label = "";

  /** Render state; reflected for styling, set by the element. */
  @property({ reflect: true })
  status: MermaidStatus = "pending";

  /**
   * Diagram source. When set, it overrides the light-DOM content; set it back
   * to `undefined` to fall back to the children again.
   */
  @property({ attribute: false })
  code?: string;

  /** Raw source read from `code` or the light DOM. */
  @state()
  private rawSource = "";

  @state()
  private svg = "";

  @state()
  private error = "";

  #source = "";
  #observer?: MutationObserver;
  #scheme?: MediaQueryList;
  #request = 0;
  #renderDone: Promise<void> = Promise.resolve();

  /** The dedented source being shown. */
  get source(): string {
    return this.#source;
  }

  /** Resolves once the current render pass (if any) has finished and updated the element. */
  get renderComplete(): Promise<void> {
    return this.#renderDone;
  }

  override connectedCallback(): void {
    super.connectedCallback();

    this.#observer ??= new MutationObserver(() => this.#syncSource());
    this.#observer.observe(this, { childList: true, characterData: true, subtree: true });
    this.#scheme ??= globalThis.matchMedia?.(DARK_SCHEME);
    this.#scheme?.addEventListener("change", this.#onSchemeChange);
    this.#syncSource();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#observer?.disconnect();
    this.#scheme?.removeEventListener("change", this.#onSchemeChange);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("code")) this.#syncSource();

    if (changed.has("rawSource" as keyof MermaidElement)) {
      const source = normalizeSource(this.rawSource);

      if (source !== this.#source) {
        this.#source = source;
        this.refresh();
      }
    }
  }

  protected override render(): unknown {
    if (this.status === "error") {
      return html`
        <p part="error" class="error" role="alert">${this.error}</p>
        <pre part="source" class="source"><code>${this.#source}</code></pre>
      `;
    }

    const labelled = !!this.label;

    return html`
      <div
        part="diagram"
        class="diagram"
        role=${labelled ? "img" : nothing}
        aria-label=${labelled ? this.label : nothing}
        aria-busy=${this.status === "pending" ? "true" : nothing}
      >
        ${unsafeHTML(this.svg)}
      </div>
    `;
  }

  /**
   * Renders the diagram again with the current theme, e.g. after changing
   * `--tp-mermaid-*` variables. Superseded passes are dropped.
   */
  refresh(): Promise<void> {
    const request = ++this.#request;
    const source = this.#source;

    if (!source) {
      this.svg = "";
      this.status = "pending";

      return (this.#renderDone = Promise.resolve());
    }

    this.status = "pending";

    this.#renderDone = renderDiagram(source, themeConfig(this)).then(
      async ({ svg, diagramType }) => {
        if (request !== this.#request) return;

        this.svg = svg;
        this.error = "";
        this.status = "rendered";
        await this.updateComplete;
        this.#dispatch({ diagramType });
      },
      async (error: unknown) => {
        if (request !== this.#request) return;

        this.svg = "";
        this.error = errorMessage(error);
        this.status = "error";
        await this.updateComplete;
        this.#dispatch({ error: this.error });
      },
    );

    return this.#renderDone;
  }

  #dispatch(detail: MermaidRenderEventDetail): void {
    this.dispatchEvent(new CustomEvent<MermaidRenderEventDetail>("tp-mermaid-render", { bubbles: true, composed: true, detail }));
  }

  #onSchemeChange = (): void => {
    if (this.#source) void this.refresh();
  };

  #syncSource(): void {
    this.rawSource = this.code ?? readSource(this);
  }
}
