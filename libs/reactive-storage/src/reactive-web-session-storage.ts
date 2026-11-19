import { AbstractReactiveWebStorage } from "./reactive-web-storage";

/**
 * Reactive storage on `sessionStorage`: data belongs to the tab and is cleared when the tab is closed.
 *
 * Works exactly like {@link ReactiveWebLocalStorage}, with the same `<appName>/<storeName>` keys
 * and store name rules; only the underlying storage differs.
 *
 * Example usage:
 * ```ts
 * import { ReactiveWebSessionStorage } from '@telperion/reactive-storage/reactive-web-session-storage';
 *
 * const draft = new ReactiveWebSessionStorage('my-app');
 *
 * await draft.set('checkout', 'step', 2); // survives a reload, not a closed tab
 * ```
 *
 * @template S - Store name type: a union of string literals restricts the store names you can use
 */
export class ReactiveWebSessionStorage<S extends string = string> extends AbstractReactiveWebStorage<S> {
  override readonly storage = window.sessionStorage;

  /**
   * @param appName - Namespace of this app's keys: each store is saved under `<appName>/<storeName>`. Defaults to `'app'`
   */
  constructor(
    override readonly appName = 'app'
  ) {
    super();
  }
}
