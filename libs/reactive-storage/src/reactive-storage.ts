/* eslint-disable @typescript-eslint/no-explicit-any */

import { Observable, distinctUntilChanged, firstValueFrom, from, lastValueFrom, map, startWith, switchMap, take } from "rxjs";
import { compact } from "@telperion/js-utils/array/compact";
import { compact as compactObject } from "@telperion/js-utils/object/compact";
import { deepFreeze } from "@telperion/js-utils/object/deep-freeze";
import { jsonEqual } from "@telperion/js-utils/object/json-equal";
import { shareLast } from "@telperion/rx-utils/operators/share-last";
import { FifoPromise } from "@telperion/ts-utils/fifo-promise";

const GET_ALL = Symbol('Reactive Storage Get All');
const CHANGES = Symbol('Reactive Storage Changes');
const SET = Symbol('Reactive Storage Set');
const REMOVE = Symbol('Reactive Storage Remove');

/**
 * A change to one store, as a storage implementation reports it to {@link ReactiveStorage}.
 * `value` is the store's new content, or `undefined` when the store was removed.
 *
 * @template S - Store name type
 */
export interface ReactiveStorageChangeEvent<S = string> {
  storeName: S;
  value: any;
}

/**
 * Abstract base class of every reactive storage: the shared `get`/`set`/`patch`/`delete`/`push`/`drop` API.
 *
 * Data is organised in named **stores**: one JSON value per store name (one localStorage key, one cookie).
 * Read and write inside a store with a dot-separated **key path** (`'profile.name'`); an empty key
 * means the whole store.
 *
 * - `get()` returns an Observable that emits the current value right away and again whenever it changes.
 *   Repeats of the same value (`===`) are skipped, so a primitive at a path emits only when it changes.
 * - Emitted values are deep-frozen: copy them before changing them.
 * - Writes return a Promise that resolves once subscribers have been notified. Writes from every
 *   storage instance run one at a time, first in first out; one that takes longer than a second
 *   is rejected with a `TimeoutError`.
 * - Only writes made through the same instance (or, for cookies, linked instances) are observed.
 *
 * Example usage:
 * ```ts
 * import { ReactiveWebLocalStorage } from '@telperion/reactive-storage/reactive-web-local-storage';
 *
 * const storage = new ReactiveWebLocalStorage<'user' | 'settings'>('my-app');
 *
 * storage.get<string>('user', 'profile.name').subscribe((name) => console.log(name));
 * // undefined
 *
 * await storage.set('user', 'profile.name', 'Ada');
 * // Ada
 * ```
 *
 * @template S - Store name type: a union of string literals restricts the store names you can use
 */
export abstract class ReactiveStorage<S extends string = string> {
  private static FifoGroup = Symbol();
  private static extractData<T = any>(data: any, prop: string = null!): T {
    if (!prop) return data;

    const fragments = compact(prop.split('.'));
    let value = data;

    do {
      try {
        value = value[fragments[0]];
      } catch {
        return undefined!;
      }

      fragments.shift();
    } while (fragments.length);

    return value;
  }

  static Props = { GET_ALL, CHANGES, SET, REMOVE } as const;

  protected abstract [GET_ALL](): Promise<any>;
  protected abstract [CHANGES]: AsyncGenerator<ReactiveStorageChangeEvent<S>>;
  protected abstract [SET](store: S, value: any): Promise<void>;
  protected abstract [REMOVE](store: S): Promise<void>;

  #_stream$: Observable<Readonly<Record<S, any>>> = null!;

  #initializeStream() {
    this.#_stream$ = from(this[GET_ALL]()).pipe(
      switchMap(data => {
        data ??= {};

        return from(this[CHANGES]).pipe(
          map(({ storeName, value }) => {
            if (value === undefined) delete data[storeName];
            else data[storeName] = value;

            return deepFreeze({ ...data });
          }),
          startWith(deepFreeze({ ...data }))
        );
      }),
      shareLast()
    );
  }

  get #stream$() {
    if (!this.#_stream$) this.#initializeStream();

    return this.#_stream$;
  }

  /**
   * Observable of a store, or of one value inside it, that emits the current value and then every change.
   *
   * The value is `undefined` while the store or path does not exist. Emitted values are deep-frozen.
   *
   * Example usage:
   * ```ts
   * storage.get('user').subscribe((user) => console.log(user));           // whole store
   * storage.get<string>('user', 'profile.name').subscribe(console.log); // one value
   * ```
   *
   * @template T - Type of the value at `key`
   * @param storeName - Store to read
   * @param key - Dot-separated path inside the store; empty (default) for the whole store
   * @returns Observable of the value, which never completes
   */
  get<T = Record<string, any>>(storeName: S, key = ''): Observable<T> {
    return this.#stream$.pipe(
      // The store by name first: store names may contain dots, key paths are split on them
      map(allData => ReactiveStorage.extractData(allData[storeName], key)),
      distinctUntilChanged()
    );
  }

  async #set(storeName: S, key: string, value: any): Promise<void> {
    const store = await firstValueFrom(this.get(storeName));
    const storeChangeEvent = lastValueFrom(this.get(storeName).pipe(take(2)));
    const paths = compact(key.split('.'));

    if (!paths.length) {
      if (value === undefined) {
        await this[REMOVE](storeName);
      } else {
        await this[SET](storeName, value);
      }

      await storeChangeEvent;

      return;
    }

    const newStore = JSON.parse(JSON.stringify(typeof store === 'object' ? store : {}));
    let lastPiece = newStore;

    while (paths.length > 1) {
      if (typeof lastPiece[paths[0]] !== 'object') lastPiece[paths[0]] = {};

      lastPiece = lastPiece[paths[0]];
      paths.shift();
    }

    if (lastPiece[paths[0]] === value) return;

    if (value === undefined) {
      delete lastPiece[paths[0]];
    } else {
      lastPiece[paths[0]] = value;
    }

    await this[SET](storeName, newStore);
    await storeChangeEvent;

    return;
  }

  /**
   * Writes a value at a path, replacing what was there and creating missing parent objects.
   *
   * The value is stored as JSON, so it must be JSON-serializable. Passing `undefined` removes
   * the property (or, with an empty key, the whole store).
   *
   * Example usage:
   * ```ts
   * await storage.set('user', '', { name: 'Ada' });          // whole store
   * await storage.set('user', 'profile.theme', 'dark');     // { name: 'Ada', profile: { theme: 'dark' } }
   * ```
   *
   * @param storeName - Store to write
   * @param key - Dot-separated path inside the store; empty for the whole store
   * @param value - New value; `undefined` removes it
   * @returns Resolves once subscribers have received the new value
   */
  @FifoPromise({ group: ReactiveStorage.FifoGroup, timeout: 1000 })
  async set(storeName: S, key: string, value: any): Promise<void> {
    return await this.#set(storeName, key, value);
  }

  /**
   * Merges the properties of an object into the object at a path (one level deep, like `Object.assign`).
   *
   * Properties of `value` that are `null` or `undefined` are skipped, so they never erase stored ones;
   * use `delete` for that. When there is no object at the path yet, `value` starts a new one.
   *
   * Example usage:
   * ```ts
   * await storage.set('user', '', { name: 'Ada', age: 36 });
   * await storage.patch('user', '', { age: 37, email: 'ada@example.com' });
   * // { name: 'Ada', age: 37, email: 'ada@example.com' }
   * ```
   *
   * @param storeName - Store to change
   * @param key - Dot-separated path of the object inside the store; empty for the whole store
   * @param value - Properties to merge in
   * @returns Resolves once subscribers have been notified
   */
  @FifoPromise({ group: ReactiveStorage.FifoGroup, timeout: 1000 })
  async patch(storeName: S, key: string, value: Record<string, any>): Promise<void> {
    const existing = await firstValueFrom(this.get<unknown>(storeName, key));
    const base = typeof existing === 'object' && existing !== null && !Array.isArray(existing) ? existing : {};

    await this.#set(storeName, key, { ...base, ...compactObject(value) });
  }

  /**
   * Removes a value at a path, or the whole store. Same as `set(storeName, key, undefined)`.
   *
   * Example usage:
   * ```ts
   * await storage.delete('user', 'profile.theme'); // one property
   * await storage.delete('user');                  // the whole store
   * ```
   *
   * @param storeName - Store to change
   * @param key - Dot-separated path inside the store; empty (default) removes the whole store
   * @returns Resolves once subscribers have been notified
   */
  @FifoPromise({ group: ReactiveStorage.FifoGroup, timeout: 1000 })
  async delete(storeName: S, key = ''): Promise<void> {
    return await this.#set(storeName, key, undefined);
  }

  /**
   * Appends values to the array at a path, creating the array when there is none.
   *
   * Example usage:
   * ```ts
   * await storage.push('todos', 'items', 'Buy milk', 'Walk the dog');
   * ```
   *
   * @param storeName - Store to change
   * @param key - Dot-separated path of the array inside the store
   * @param values - Values to append
   * @returns Resolves once subscribers have been notified
   */
  @FifoPromise({ group: ReactiveStorage.FifoGroup, timeout: 1000 })
  async push(storeName: S, key: string, ...values: any[]): Promise<void> {
    const existing = await firstValueFrom(this.get<any[]>(storeName, key)) ?? [];

    await this.#set(storeName, key, [...existing, ...values]);
  }

  /**
   * Removes the first item of the array at a path that equals `value`.
   *
   * Items are compared by content, as JSON: objects match when they have the same properties and
   * values, in any order. Nothing happens when there is no array at the path or no item matches.
   *
   * Example usage:
   * ```ts
   * await storage.set('todos', 'items', [{ id: 1, text: 'Buy milk' }, { id: 2, text: 'Walk the dog' }]);
   * await storage.drop('todos', 'items', { id: 1, text: 'Buy milk' });
   * // [{ id: 2, text: 'Walk the dog' }]
   * ```
   *
   * @param storeName - Store to change
   * @param key - Dot-separated path of the array inside the store
   * @param value - Item to remove
   * @returns Resolves once subscribers have been notified
   */
  @FifoPromise({ group: ReactiveStorage.FifoGroup, timeout: 1000 })
  async drop(storeName: S, key: string, value: any): Promise<void> {
    const existing = await firstValueFrom(this.get<unknown>(storeName, key));

    if (!Array.isArray(existing)) return;

    // Compare with the value as it would be stored (e.g. without `undefined` properties)
    const stored = value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    const index = existing.findIndex((item) => jsonEqual(item, stored));

    if (index < 0) return;

    await this.#set(storeName, key, existing.filter((_, position) => position !== index));
  }
}
