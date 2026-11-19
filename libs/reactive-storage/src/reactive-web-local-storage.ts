import { AbstractReactiveWebStorage } from "./reactive-web-storage";

/**
 * Reactive storage on `localStorage`: data stays until it is removed, across tabs and browser restarts.
 *
 * Each store is one localStorage key, `<appName>/<storeName>`, holding the store as JSON.
 * Existing keys of the same app are read when the first value is requested. Store names must be
 * word characters (`[A-Za-z0-9_]`): other names are saved but not read back after a reload.
 *
 * Changes made in other tabs, or by other instances, are not observed.
 *
 * Example usage:
 * ```ts
 * import { ReactiveWebLocalStorage } from '@telperion/reactive-storage/reactive-web-local-storage';
 *
 * const storage = new ReactiveWebLocalStorage<'settings'>('my-app');
 *
 * storage.get<'light' | 'dark'>('settings', 'theme').subscribe((theme) => {
 *   document.documentElement.dataset.theme = theme ?? 'light';
 * });
 *
 * await storage.set('settings', 'theme', 'dark'); // saved as my-app/settings = {"theme":"dark"}
 * ```
 *
 * @template S - Store name type: a union of string literals restricts the store names you can use
 */
export class ReactiveWebLocalStorage<S extends string = string> extends AbstractReactiveWebStorage<S> {
  override readonly storage = window.localStorage;

  /**
   * @param appName - Namespace of this app's keys: each store is saved under `<appName>/<storeName>`. Defaults to `'app'`
   */
  constructor(
    override readonly appName = 'app'
  ) {
    super();
  }
}
