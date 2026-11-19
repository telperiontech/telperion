import { Subject } from 'rxjs';
import { makeAsyncIterator } from '@telperion/rx-utils/to-async-iteratable';

import { ReactiveStorage, ReactiveStorageChangeEvent } from "./reactive-storage";
import { RegexParser } from './regex-parser';
import { jsonParse } from './json-parse';

/**
 * Abstract implementation of ReactiveStorage for browser Web Storage API.
 * Stores data as JSON in localStorage or sessionStorage with app namespacing.
 *
 * @template S - Storage store name type
 */
export abstract class AbstractReactiveWebStorage<S extends string = string> extends ReactiveStorage<S> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static #parse(string: string): any {
    return jsonParse(string);
  }

  protected abstract readonly appName: string;
  abstract readonly storage: Storage;

  get #keyNameRegex() {
    return RegexParser(`^${this.appName}\\/\\w+$`);
  }

  #changes$ = new Subject<ReactiveStorageChangeEvent<S>>();

	protected async [ReactiveStorage.Props.GET_ALL]() {
		const keys = Object.keys(this.storage).filter(key => this.#keyNameRegex.test(key));

    return Object.fromEntries(keys.map(key => [
      key.split('/')[1],
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
 * Generic reactive web storage wrapper.
 * Allows using any Storage implementation (localStorage, sessionStorage, or custom).
 *
 * @template S - Storage store name type
 */
export class ReactiveWebStorage<S extends string = string> extends AbstractReactiveWebStorage<S> {
  constructor(
    override readonly storage: Storage,
    override readonly appName = 'app',
  ) {
    super();
  }
}
