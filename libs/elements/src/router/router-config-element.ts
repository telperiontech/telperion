import { LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { noop } from "@telperion/js-utils/function/noop";

import { SignalWatcherLitElement } from "../utils/signal-watcher-lit-element";
import { GLOBAL_HISTORY_TYPE } from "./history";
import { HISTORY_TYPE, HistoryManaged } from "./history-managed";

declare global {
  interface HTMLElementTagNameMap {
    /**
     * A configuration element for managing router history settings.
     *
     * Behavior depends on placement:
     * - **In `<head>`**: Sets global history for all routers
     * - **In `<body>`**: Provides local history for descendant routers
     */
    "tp-router-config": RouterConfigElement;
  }
}

/**
 * A custom element for configuring router history settings.
 *
 * This element serves dual purposes depending on its placement in the DOM:
 *
 * ## Global Configuration (placed in `<head>`)
 *
 * When placed in the `<head>` element, it sets the **global default history**
 * for all routers in the application that don't specify their own history or
 * inherit from a parent.
 *
 * ```html
 * <head>
 *   <!-- All routers will use hash routing by default -->
 *   <tp-router-config history="hash"></tp-router-config>
 * </head>
 * <body>
 *   <tp-router>
 *     <!-- Uses hash history (global default) -->
 *     <tp-route path="/home">...</tp-route>
 *   </tp-router>
 * </body>
 * ```
 *
 * ## Local Configuration (placed in `<body>`)
 *
 * When placed in the `<body>` element, it provides history configuration
 * for its **descendant routers only**. This allows different sections of
 * your application to use different history strategies.
 *
 * ```html
 * <body>
 *   <!-- Section 1: Hash routing -->
 *   <tp-router-config history="hash">
 *     <tp-router>
 *       <!-- Uses hash history from parent config -->
 *       <tp-route path="/dashboard">...</tp-route>
 *     </tp-router>
 *   </tp-router-config>
 *
 *   <!-- Section 2: Memory routing (isolated) -->
 *   <tp-router-config history="memory">
 *     <tp-router>
 *       <!-- Uses memory history from parent config -->
 *       <tp-route path="/preview">...</tp-route>
 *     </tp-router>
 *   </tp-router-config>
 * </body>
 * ```
 *
 * ## Usage Patterns
 *
 * ### Set Global Default
 *
 * Place in `<head>` to configure all routers:
 *
 * ```html
 * <!DOCTYPE html>
 * <html>
 *   <head>
 *     <tp-router-config history="browser"></tp-router-config>
 *   </head>
 *   <body>
 *     <!-- All routers use browser history -->
 *   </body>
 * </html>
 * ```
 *
 * ### Override for Specific Section
 *
 * Use local config to override global default:
 *
 * ```html
 * <head>
 *   <!-- Global: browser history -->
 *   <tp-router-config history="browser"></tp-router-config>
 * </head>
 * <body>
 *   <!-- Main app uses browser history -->
 *   <tp-router>...</tp-router>
 *
 *   <!-- Admin section uses hash history -->
 *   <tp-router-config history="hash">
 *     <tp-router>...</tp-router>
 *   </tp-router-config>
 * </body>
 * ```
 *
 * ### Isolate Components with Memory History
 *
 * Use named memory history for component isolation:
 *
 * ```html
 * <body>
 *   <!-- Each component has independent navigation -->
 *   <tp-router-config history="memory:component1">
 *     <my-widget>
 *       <tp-router>...</tp-router>
 *     </my-widget>
 *   </tp-router-config>
 *
 *   <tp-router-config history="memory:component2">
 *     <my-widget>
 *       <tp-router>...</tp-router>
 *     </my-widget>
 *   </tp-router-config>
 * </body>
 * ```
 *
 * ### Testing with Memory History
 *
 * Use memory history to avoid affecting browser URL during tests:
 *
 * ```typescript
 * import { fixture, html } from '@open-wc/testing';
 *
 * it('should navigate', async () => {
 *   const el = await fixture(html`
 *     <tp-router-config history="memory:test">
 *       <tp-router>
 *         <tp-route path="/test">Test Page</tp-route>
 *       </tp-router>
 *     </tp-router-config>
 *   `);
 *
 *   // Test navigation without affecting browser URL
 * });
 * ```
 *
 * ## History Resolution
 *
 * Router components resolve their history in this order:
 *
 * 1. **Own `history` attribute** (highest priority)
 * 2. **Parent `tp-router-config`** (local configuration)
 * 3. **Global `tp-router-config`** (in `<head>`)
 * 4. **Default** (`"browser"`)
 *
 * ## Best Practices
 *
 * ✅ **DO**: Place one `tp-router-config` in `<head>` for global settings
 *
 * ```html
 * <head>
 *   <tp-router-config history="browser"></tp-router-config>
 * </head>
 * ```
 *
 * ✅ **DO**: Use local configs for sections with different routing needs
 *
 * ```html
 * <tp-router-config history="memory">
 *   <component-preview>...</component-preview>
 * </tp-router-config>
 * ```
 *
 * ✅ **DO**: Use named memory history for isolated components
 *
 * ```html
 * <tp-router-config history="memory:sidebar">
 *   <sidebar-nav>...</sidebar-nav>
 * </tp-router-config>
 * ```
 *
 * ❌ **DON'T**: Place multiple configs in `<head>` (last one wins)
 *
 * ```html
 * <head>
 *   <tp-router-config history="browser"></tp-router-config>
 *   <tp-router-config history="hash"></tp-router-config> <!-- Overrides above -->
 * </head>
 * ```
 *
 * ❌ **DON'T**: Nest configs unnecessarily (inner configs take precedence)
 *
 * ```html
 * <tp-router-config history="browser">
 *   <tp-router-config history="hash">
 *     <!-- Uses hash, not browser -->
 *   </tp-router-config>
 * </tp-router-config>
 * ```
 */
@customElement('tp-router-config')
export class RouterConfigElement extends HistoryManaged(SignalWatcherLitElement) {
  /**
   * Cleanup function for the global history effect.
   * Only used when the element is placed in `<head>`.
   * @private
   */
  #globalHistoryUnsubscribe = noop;

  /**
   * Called when the element is connected to the DOM.
   *
   * - If in `<head>`: Sets up a reactive effect to update global history
   * - If in `<body>`: Only provides history to descendants (no special setup)
   */
  override connectedCallback(): void {
    super.connectedCallback();

    if (!document.head.contains(this)) return;

    console.log('RouterConfigElement: Setting global history type to', this[HISTORY_TYPE].get());

    // Set the global history type when this element is connected in <head>
    this.#globalHistoryUnsubscribe = this.updateEffect(() => {
      GLOBAL_HISTORY_TYPE.set(this[HISTORY_TYPE].get()!);
    });
  }

  /**
   * Called when the element is disconnected from the DOM.
   *
   * Cleans up the global history effect if it was set up.
   */
  override disconnectedCallback(): void {
    super.disconnectedCallback();

    try {
      this.#globalHistoryUnsubscribe();
    } catch {}
  }

  /**
   * Creates the render root for the element.
   * Returns the element itself to render children in light DOM.
   *
   * @returns The element itself (not a shadow root)
   */
  protected override createRenderRoot() {
    return this;
  }
}
