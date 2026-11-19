import { Subject } from 'rxjs';
import { makeAsyncIterator } from '@telperion/rx-utils/to-async-iteratable';

import { ReactiveStorage, ReactiveStorageChangeEvent } from "./reactive-storage";
import { jsonParse } from './json-parse';

/**
 * Base class of the Web Storage implementations: saves each store as JSON under `<appName>/<storeName>`
 * in `storage`. Extend it to back a reactive storage with another `Storage` object.
 *
 * @template S - Store name type
 */
export abstract class AbstractReactiveWebStorage<S extends string = string> extends ReactiveStorage<S> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static #parse(string: string): any {
    return jsonParse(string);
  }

  protected abstract readonly appName: string;
  /** The Web Storage object the stores are saved in */
  abstract readonly storage: Storage;

  #changes$ = new Subject<ReactiveStorageChangeEvent<S>>();

	protected async [ReactiveStorage.Props.GET_ALL]() {
		const prefix = `${this.appName}/`;
		// Through the Storage interface, so custom Storage implementations are read too
		const keys = Array.from({ length: this.storage.length }, (_, index) => this.storage.key(index))
			.filter((key): key is string => !!key && key.startsWith(prefix) && key.length > prefix.length);

    return Object.fromEntries(keys.map(key => [
      key.slice(prefix.length),
      AbstractReactiveWebStorage.#parse(this.storage.getItem(key)!)
    ]));
	}

	// Prefer an Observable's own async iterator (rxjs 8, or `@telperion/rx-utils/static/async-iterator`)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	protected [ReactiveStorage.Props.CHANGES]: AsyncGenerator<ReactiveStorageChangeEvent<S>> = (this.#changes$ as any)[Symbol.asyncIterator]?.() ?? makeAsyncIterator(this.#changes$);

	protected async [ReactiveStorage.Props.SET](storeName: S, value: unknown) {
    this.storage.setItem(`${this.appName}/${storeName}`, JSON.stringify(value));
    this.#changes$.next({ storeName, value });
	}

  protected async [ReactiveStorage.Props.REMOVE](storeName: S) {
    this.storage.removeItem(`${this.appName}/${storeName}`);
    this.#changes$.next({ storeName, value: undefined });
  }
}

/**
 * Reactive storage on any `Storage` object you pass in: `localStorage`, `sessionStorage`, or your own
 * implementation of the Web Storage interface (an in-memory one for tests or server rendering, say).
 *
 * Keys are those of {@link ReactiveWebLocalStorage}: `<appName>/<storeName>`.
 *
 * Example usage:
 * ```ts
 * import { ReactiveWebStorage } from '@telperion/reactive-storage/reactive-web-storage';
 *
 * const storage = new ReactiveWebStorage(window.localStorage, 'my-app');
 * ```
 *
 * @template S - Store name type: a union of string literals restricts the store names you can use
 */
export class ReactiveWebStorage<S extends string = string> extends AbstractReactiveWebStorage<S> {
  /**
   * @param storage - Web Storage object to save the stores in
   * @param appName - Namespace of this app's keys: each store is saved under `<appName>/<storeName>`. Defaults to `'app'`
   */
  constructor(
    override readonly storage: Storage,
    override readonly appName = 'app',
  ) {
    super();
  }
}
