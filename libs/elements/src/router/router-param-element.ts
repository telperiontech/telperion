/**
 * @fileoverview Router parameter display component
 *
 * Provides a declarative way to display dynamic route parameter values
 * directly in HTML templates without requiring JavaScript.
 *
 * @module router/tp-router-param
 */

import { customElement, property } from "lit/decorators.js";
import { SignalWatcherLitElement } from "../utils/signal-watcher-lit-element";
import { computed, html, signal } from "@lit-labs/signals";
import { PARAMS, type RouterOutletElement } from "./router-outlet-element";

declare global {
  interface HTMLElementTagNameMap {
    /**
     * A component that displays the value of a route parameter.
     *
     * Must be used within a tp-router-outlet element. Automatically
     * updates when route parameters change.
     */
    'tp-router-param': RouterParamElement;
  }
}

/**
 * Custom element for displaying dynamic route parameter values.
 *
 * This component provides a declarative way to access and display URL
 * parameters extracted from dynamic route segments without writing JavaScript.
 * It must be used inside a `<tp-router-outlet>` element.
 *
 * ## Features
 *
 * - **Declarative**: Access params directly in HTML
 * - **Reactive**: Automatically updates when route changes
 * - **Hierarchical**: Inherits params from parent outlets
 * - **Type-safe**: Integrated with TypeScript definitions
 *
 * ## Usage
 *
 * ### Basic Parameter Display
 *
 * ```html
 * <tp-router>
 *   <tp-route path="/users/:id">
 *     <template>
 *       <h1>User Profile</h1>
 *       <p>User ID: <tp-router-param name="id"></tp-router-param></p>
 *     </template>
 *   </tp-route>
 *   <tp-router-outlet></tp-router-outlet>
 * </tp-router>
 * ```
 *
 * When navigating to `/users/123`, the component renders: `User ID: 123`
 *
 * ### Multiple Parameters
 *
 * ```html
 * <tp-route path="/blog/:year/:month/:slug">
 *   <template>
 *     <article>
 *       <header>
 *         <time>
 *           <tp-router-param name="year"></tp-router-param>-
 *           <tp-router-param name="month"></tp-router-param>
 *         </time>
 *         <h1><tp-router-param name="slug"></tp-router-param></h1>
 *       </header>
 *     </article>
 *   </template>
 * </tp-route>
 * ```
 *
 * For `/blog/2024/12/hello-world`, renders:
 * ```html
 * <time>2024-12</time>
 * <h1>hello-world</h1>
 * ```
 *
 * ### Nested Routes with Parameter Inheritance
 *
 * ```html
 * <tp-router>
 *   <tp-route path="/projects/:projectId">
 *     <template>
 *       <h1>Project <tp-router-param name="projectId"></tp-router-param></h1>
 *
 *       <!-- Nested outlet inherits projectId parameter -->
 *       <tp-router-outlet>
 *         <tp-route path="/tasks/:taskId">
 *           <template>
 *             <!-- Both params are available -->
 *             <h2>Task Details</h2>
 *             <p>Project: <tp-router-param name="projectId"></tp-router-param></p>
 *             <p>Task: <tp-router-param name="taskId"></tp-router-param></p>
 *           </template>
 *         </tp-route>
 *       </tp-router-outlet>
 *     </template>
 *   </tp-route>
 *   <tp-router-outlet></tp-router-outlet>
 * </tp-router>
 * ```
 *
 * ### With Styling
 *
 * ```html
 * <style>
 *   tp-router-param {
 *     font-weight: bold;
 *     color: var(--primary-color);
 *   }
 *
 *   tp-router-param[name="id"] {
 *     font-family: monospace;
 *   }
 * </style>
 *
 * <tp-route path="/users/:id">
 *   <template>
 *     <span>User: <tp-router-param name="id"></tp-router-param></span>
 *   </template>
 * </tp-route>
 * ```
 *
 * ## How It Works
 *
 * 1. On connection, finds the nearest parent `<tp-router-outlet>`
 * 2. Accesses the outlet's PARAMS signal containing all route parameters
 * 3. Computes and displays the value for the specified parameter name
 * 4. Automatically re-renders when the route (and thus params) change
 *
 * ## Error Handling
 *
 * Throws an error if not placed within a `<tp-router-outlet>`:
 *
 * ```javascript
 * // ✗ Wrong - not inside outlet
 * <tp-router-param name="id"></tp-router-param>
 *
 * // ✓ Correct - inside outlet
 * <tp-router-outlet>
 *   <tp-router-param name="id"></tp-router-param>
 * </tp-router-outlet>
 * ```
 *
 * ## Alternative: Using Attributes
 *
 * The parent `<tp-router-outlet>` also exposes parameters as `param-*` attributes,
 * which can be used as an alternative approach:
 *
 * ```html
 * <tp-router-outlet id="outlet">
 *   <script>
 *     const outlet = document.getElementById('outlet');
 *     // Params available as: outlet.getAttribute('param-id')
 *   </script>
 * </tp-router-outlet>
 * ```
 *
 * However, `<tp-router-param>` is preferred for declarative templates.
 *
 * @example Basic usage
 * ```html
 * <tp-router>
 *   <tp-route path="/product/:sku">
 *     <template>
 *       <h1>Product: <tp-router-param name="sku"></tp-router-param></h1>
 *     </template>
 *   </tp-route>
 *   <tp-router-outlet></tp-router-outlet>
 * </tp-router>
 * ```
 *
 * @example Multiple params with formatting
 * ```html
 * <tp-route path="/user/:username/post/:postId">
 *   <template>
 *     <article>
 *       <p>@<tp-router-param name="username"></tp-router-param></p>
 *       <p>Post #<tp-router-param name="postId"></tp-router-param></p>
 *     </article>
 *   </template>
 * </tp-route>
 * ```
 */
@customElement('tp-router-param')
export class RouterParamElement extends SignalWatcherLitElement {
  /**
   * Signal holding reference to the parent outlet.
   * Set during connectedCallback.
   */
  #outlet = signal<RouterOutletElement>(null!);

  /**
   * Signal tracking the parameter name to display.
   * Updated when the 'name' attribute changes.
   */
  #name = signal<string>('');

  /**
   * Computed signal that extracts the parameter value.
   * Reactively updates when the outlet's params or name changes.
   */
  #value = computed(() => this.#outlet.get()?.[PARAMS]?.get()[this.#name.get()]);

  /**
   * The name of the route parameter to display.
   *
   * Must match a parameter name defined in the route's path pattern.
   * For example, for path `/users/:id`, use `name="id"`.
   *
   * @attr name
   * @type {string}
   */
  @property({ type: String })
  name: string = '';

  /**
   * Lifecycle callback when element is connected to the DOM.
   *
   * Finds the parent `<tp-router-outlet>` and stores a reference.
   * Throws an error if not used within an outlet.
   *
   * @throws {Error} If no parent tp-router-outlet is found
   */
  override connectedCallback(): void {
    super.connectedCallback();

    const outlet = this.closest('tp-router-outlet');

    if (!outlet) {
      throw new Error('<tp-router-param> must be used within a <tp-router-outlet>.');
    }

    this.#outlet.set(outlet);
  }

  /**
   * Lifecycle callback when observed attributes change.
   *
   * Updates the internal name signal when the 'name' attribute changes,
   * which triggers the computed value signal to recalculate and re-render.
   *
   * @param name - The attribute name that changed
   * @param _old - Previous attribute value (unused)
   * @param value - New attribute value
   */
  override attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, _old, value);

    switch (name) {
      case 'name':
        this.#name.set(value ?? '');
        break;
    }
  }

  /**
   * Renders the parameter value.
   *
   * The value is extracted from the outlet's params signal and
   * displayed as text content. Automatically updates when the
   * route changes.
   *
   * @returns The parameter value as a template result
   */
  protected override render() {
    return html`${this.#value}`;
  }
}
