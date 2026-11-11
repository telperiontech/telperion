import { computed, signal } from "@lit-labs/signals";
import type { URLPattern } from "@telperion/extra-ts-types/polyfills/url-pattern";
import { LitElement, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createRouteSourceEvent, ROUTE_ERROR_EVENT, ROUTE_LOAD_EVENT } from "./route-events";
import {
  defaultRouteSourceLoader,
  resolveRouteSrc,
  RouteSource,
  RouteSourceLoader,
  RouteSourceState,
  RouteSourceStatus,
} from "./route-source";
import { readRouteTemplates } from "./route-templates";

declare global {
  interface HTMLElementTagNameMap {
    /**
     * A route definition element for client-side routing.
     * It contains a template with the content to render when the route is active,
     * or a `src` URL to load the content from when the route first becomes active.
     * The `path` attribute defines the URL pattern to match using URLPattern syntax.
     * Must be a child of a tp-router element.
     */
    "tp-route": RouteElement;
  }
}

/**
 * Symbol used to access the route's content fragment signal.
 * @internal
 */
export const FRAGMENT = Symbol('RouteElement:fragment');
/**
 * Symbol used to access the route's URLPattern instance.
 * @internal
 */
export const PATH_PATTERN = Symbol('RouteElement:path-pattern');
/**
 * Symbol used to access the status signal of the route's `src` content.
 * @internal
 */
export const SOURCE_STATUS = Symbol('RouteElement:source-status');
/**
 * Symbol used by the router to mark the route as active or inactive.
 * @internal
 */
export const SET_ACTIVE = Symbol('RouteElement:set-active');

/** Boolean attributes reflecting the status of the route's `src` content. */
const STATUS_ATTRIBUTES = ['loading', 'loaded', 'error'] as const satisfies readonly RouteSourceStatus[];

/**
 * A custom element that defines a route in the router.
 *
 * The route's content comes from either:
 * - an inline `<template>` child, or
 * - a `src` URL, fetched the first time the route becomes active and cached
 *   until `src` changes. Optional `<template data-loading>` and
 *   `<template data-error>` children are rendered while loading and on failure.
 *
 * The `path` attribute uses URLPattern syntax and supports:
 * - Static paths: `/about`, `/users`
 * - Dynamic segments: `/users/:id`, `/posts/:category/:slug`
 * - Wildcards: `/blog/*`, `/docs/**`
 *
 * While a `src` is involved, the route reflects its status as one of the
 * boolean attributes `loading`, `loaded` or `error`.
 *
 * @fires tp-route-load - The `src` content has loaded. `detail: { src }`
 * @fires tp-route-error - The `src` content failed to load. `detail: { src, error }`
 *
 * @example
 * ```html
 * <tp-router>
 *   <tp-route path="/">
 *     <template><h1>Home Page</h1></template>
 *   </tp-route>
 *   <tp-route path="/docs/:slug" src="/partials/docs.html">
 *     <template data-loading><p>Loading…</p></template>
 *     <template data-error><p>Could not load the docs.</p></template>
 *   </tp-route>
 *   <tp-router-outlet></tp-router-outlet>
 * </tp-router>
 * ```
 */
@customElement('tp-route')
export class RouteElement extends LitElement {
  /** The route's `<template>` children, grouped by role. */
  #templates = signal(readRouteTemplates(this));

  /** Loader and cache for the `src` content. */
  #source = new RouteSource(state => this.#onSourceChange(state));

  /** Whether the router currently matches this route. */
  #active = false;

  /**
   * Signal with the fragment to render for this route:
   * - no `src`: the inline template's content
   * - `src` loaded: the fetched content
   * - `src` failed: the `data-error` template's content
   * - otherwise: the `data-loading` template's content
   * @internal
   */
  [FRAGMENT] = computed<DocumentFragment | null>(() => {
    const templates = this.#templates.get();
    const { status, fragment } = this.#source.state.get();

    switch (status) {
      case 'none': return templates.content;
      case 'loaded': return fragment;
      case 'error': return templates.error;
      default: return templates.loading;
    }
  });

  /**
   * Signal with the status of the route's `src` content.
   * @internal
   */
  [SOURCE_STATUS] = computed<RouteSourceStatus>(() => this.#source.state.get().status);

  /**
   * URLPattern instance for matching the current URL against this route's path.
   * @internal
   */
  [PATH_PATTERN]: URLPattern | null = null;

  /**
   * The URL pattern to match for this route.
   * Uses URLPattern syntax with support for dynamic segments and wildcards.
   *
   * @attr path
   * @example "/users/:id"
   * @example "/blog/*"
   */
  @property({ type: String })
  path: string | null = null;

  /**
   * URL of an HTML file to use as the route's content, resolved against
   * `document.baseURI`. Fetched the first time the route becomes active and
   * cached until it changes. Takes precedence over the inline `<template>`.
   *
   * The fetched HTML is trusted like `innerHTML`: it is inserted as-is,
   * although its `<script>` elements do not run.
   *
   * @attr src
   * @example "/partials/about.html"
   */
  @property({ type: String })
  src: string | null = null;

  /**
   * Function that fetches the `src` content. Override it to add headers,
   * credentials or caching, or to stub requests in tests. It receives the
   * absolute URL and an `AbortSignal`, and must reject on failure.
   */
  loader: RouteSourceLoader = defaultRouteSourceLoader;

  /** Observes changes to child elements to detect template updates */
  #templateObserver = new MutationObserver(() => {
    this.#templates.set(readRouteTemplates(this));
  });

  /**
   * Lifecycle callback when the element is connected to the DOM.
   * Sets up observer to watch for template content changes.
   */
  override connectedCallback(): void {
    super.connectedCallback();

    this.#templateObserver.observe(this, { childList: true });
    this.#templates.set(readRouteTemplates(this));

    // Resume a request cancelled by a previous disconnect
    if (this.#active) this.#syncSource();
  }

  /**
   * Lifecycle callback when an attribute changes.
   * Updates the URLPattern when the path attribute changes, and the content
   * source when the src attribute changes.
   *
   * @param name - The attribute name that changed
   * @param _old - The old attribute value
   * @param value - The new attribute value
   */
  override attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, _old, value);

    switch (name) {
      case 'path':
        this[PATH_PATTERN] = value ? new URLPattern({ pathname: value }) : null;

        break;
      case 'src':
        this.#syncSource();

        break;
    }
  }

  /**
   * Picks up `src` changes made through the property. Loads the new content
   * right away when the route is active.
   */
  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);

    if (changed.has('src')) this.#syncSource();
  }

  /**
   * Called by the router when this route starts or stops matching.
   * Activating a route with a `src` loads its content unless already cached.
   *
   * @internal
   */
  [SET_ACTIVE](active: boolean): void {
    this.#active = active;
    this.#syncSource();
  }

  /**
   * Points the source at the current `src` and loads it when active.
   */
  #syncSource(): void {
    this.#source.setUrl(this.src ? resolveRouteSrc(this.src) : null);

    if (this.#active) void this.#source.load(this.loader);
  }

  /**
   * Reflects the source status as attributes and dispatches load/error events.
   */
  #onSourceChange({ status, url, error }: RouteSourceState): void {
    for (const attribute of STATUS_ATTRIBUTES) {
      this.toggleAttribute(attribute, attribute === status);
    }

    if (!url) return;

    if (status === 'loaded') this.dispatchEvent(createRouteSourceEvent(ROUTE_LOAD_EVENT, { src: url }));

    if (status === 'error') this.dispatchEvent(createRouteSourceEvent(ROUTE_ERROR_EVENT, { src: url, error }));
  }

  /**
   * Lifecycle callback when the element is disconnected from the DOM.
   * Cleans up the template observer and cancels any in-flight request.
   */
  override disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#templateObserver.disconnect();
    this.#source.abort();
  }
}
