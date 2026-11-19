import { Subject } from 'rxjs';
import { makeAsyncIterator } from '@telperion/rx-utils/to-async-iteratable';

import { ReactiveStorage, ReactiveStorageChangeEvent } from './reactive-storage';
import { jsonParse } from './json-parse';

/**
 * Attributes written with every cookie of a {@link ReactiveCookieStorage}. Unset attributes are
 * left out of the cookie, so the browser applies its own defaults.
 */
export interface ReactiveCookieStorageOptions {
  /** URL path the cookie is sent for, e.g. `'/'` for the whole site. Unset: the path of the current page */
  path?: string;
  /** Domain the cookie is sent to, e.g. `'example.com'` to include subdomains. Unset: the current host only */
  domain?: string;
  /** Lifetime in seconds. With neither `maxAge` nor `expires`, it is a session cookie */
  maxAge?: number;
  /** Absolute expiry date. With neither `maxAge` nor `expires`, it is a session cookie */
  expires?: Date;
  /** Send the cookie over HTTPS only */
  secure?: boolean;
  /** Cross-site sending policy. Unset: the browser default, `lax` in current browsers */
  sameSite?: 'strict' | 'lax' | 'none';
}

/**
 * Reactive storage on `document.cookie`: for small values the server should see too, or that must expire.
 *
 * Each store is one cookie named `<appName>_<storeName>`, holding the store as URI-encoded JSON.
 * Characters a cookie name cannot hold are percent-encoded in both parts (`user.settings` stays,
 * `user settings` becomes `user%20settings`). Every cookie is written with the attributes given in `options`.
 *
 * - A cookie is limited to 4000 bytes; a larger write is rejected with an error.
 * - Browsers have no change event for cookies, so only writes made through this instance are observed.
 *   Pass the same `linker` to several instances to have each one notified of the others' writes.
 * - `httpOnly` cookies set by the server cannot be read or written from JavaScript.
 *
 * Example usage:
 * ```ts
 * import { ReactiveCookieStorage } from '@telperion/reactive-storage/reactive-cookie-storage';
 *
 * const storage = new ReactiveCookieStorage('my-app', { path: '/', maxAge: 60 * 60 * 24, sameSite: 'strict' });
 *
 * await storage.set('consent', 'analytics', true); // cookie my-app_consent, valid for a day
 * ```
 *
 * Linked instances:
 * ```ts
 * const linker = Symbol('cookies');
 * const header = new ReactiveCookieStorage('my-app', { path: '/' }, linker);
 * const settings = new ReactiveCookieStorage('my-app', { path: '/' }, linker);
 *
 * header.get('prefs', 'theme').subscribe(console.log);
 * await settings.set('prefs', 'theme', 'dark'); // header logs "dark"
 * ```
 *
 * @template S - Store name type: a union of string literals restricts the store names you can use
 */
export class ReactiveCookieStorage<S extends string = string> extends ReactiveStorage<S> {
  static readonly #MAX_COOKIE_SIZE = 4000; // Conservative 4KB limit
  static readonly #LINKERS = new Map<any, Set<ReactiveCookieStorage<any>>>();

  /**
   * Safely parse JSON with error handling.
   * Returns undefined if parsing fails.
   */
  static #parse(value: string): any {
    return jsonParse(value);
  }

  readonly #changes$ = new Subject<ReactiveStorageChangeEvent<S>>();
  readonly #linker?: any;

  /**
   * @param appName - Prefix of this app's cookie names: each store is saved as `<appName>_<storeName>`. Defaults to `'app'`
   * @param options - Attributes written with every cookie
   * @param linker - Any truthy value, e.g. a symbol: instances created with the same linker are notified of each other's writes
   */
  constructor(
    public readonly appName: string = 'app',
    private readonly options: ReactiveCookieStorageOptions = {},
    linker?: any
  ) {
    super();

    // Register to linker group if provided
    if (linker) {
      this.#linker = linker;
      if (!ReactiveCookieStorage.#LINKERS.has(linker)) {
        ReactiveCookieStorage.#LINKERS.set(linker, new Set());
      }
      ReactiveCookieStorage.#LINKERS.get(linker)!.add(this);
    }
  }

  /**
   * Releases the instance: unlinks it from its linker group and stops its change stream.
   * Call it when the storage is no longer used, so linked instances do not keep it alive.
   */
  destroy(): void {
    // Unregister from linker group
    if (this.#linker) {
      const linkedInstances = ReactiveCookieStorage.#LINKERS.get(this.#linker);
      if (linkedInstances) {
        linkedInstances.delete(this);
        if (linkedInstances.size === 0) {
          ReactiveCookieStorage.#LINKERS.delete(this.#linker);
        }
      }
    }

    this.#changes$.complete();
  }

  protected async [ReactiveStorage.Props.GET_ALL](): Promise<any> {
    const cookies = this.#getAppCookies();

    return Object.fromEntries(
      Object.entries(cookies).map(([storeName, value]) => [storeName, ReactiveCookieStorage.#parse(value)])
    );
  }

  // Prefer an Observable's own async iterator (rxjs 8, or `@telperion/rx-utils/static/async-iterator`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected [ReactiveStorage.Props.CHANGES]: AsyncGenerator<ReactiveStorageChangeEvent<S>> = (this.#changes$ as any)[Symbol.asyncIterator]?.() ?? makeAsyncIterator(this.#changes$);

  protected async [ReactiveStorage.Props.SET](storeName: S, value: unknown): Promise<void> {
    const serialized = JSON.stringify(value);
    const cookieName = this.#getCookieName(storeName);

    // Validate size before setting
    const cookieString = `${cookieName}=${encodeURIComponent(serialized)}`;
    this.#validateSize(cookieString);

    this.#setCookie(cookieName, serialized); // Uses instance options

    const event = { storeName, value };
    this.#changes$.next(event);
    this.#notifyLinkedInstances(event);
  }

  protected async [ReactiveStorage.Props.REMOVE](storeName: S): Promise<void> {
    const cookieName = this.#getCookieName(storeName);

    // Delete cookie by setting max-age to 0
    this.#setCookie(cookieName, '', { maxAge: 0 });

    const event = { storeName, value: undefined };
    this.#changes$.next(event);
    this.#notifyLinkedInstances(event);
  }

  /**
   * Cookie-name-safe form of an app or store name that decodes back to it: URI encoding, plus
   * `(` and `)`, which it leaves but cookie names forbid. Letters, digits, `_` and `-` stay as they are.
   */
  static #encodeName(name: string): string {
    return encodeURIComponent(name).replace(/[()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  }

  /** `<appName>_<storeName>`, each part encoded with {@link ReactiveCookieStorage.#encodeName} */
  #getCookieName(storeName: S): string {
    return `${this.#cookiePrefix}${ReactiveCookieStorage.#encodeName(storeName)}`;
  }

  get #cookiePrefix(): string {
    return `${ReactiveCookieStorage.#encodeName(this.appName)}_`;
  }

  /**
   * Parse document.cookie string into key-value object.
   * Handles decoding of cookie values.
   */
  #parseCookies(): Record<string, string> {
    if (!document.cookie) {
      return {};
    }

    return Object.fromEntries(
      document.cookie
        .split('; ')
        .filter(Boolean)
        .map((cookie) => {
          const separatorIndex = cookie.indexOf('=');
          if (separatorIndex === -1) {
            return [cookie, ''];
          }
          const name = cookie.slice(0, separatorIndex);
          const value = cookie.slice(separatorIndex + 1);
          try {
            return [name, decodeURIComponent(value)];
          } catch {
            return [name, value]; // Return raw value if decode fails
          }
        })
    );
  }

  /**
   * Get all cookies that belong to this app (matching appName prefix).
   * Returns object with storeName -> encoded value.
   */
  #getAppCookies(): Record<string, string> {
    const allCookies = this.#parseCookies();
    const prefix = this.#cookiePrefix;
    const appCookies: Record<string, string> = {};

    for (const [cookieName, value] of Object.entries(allCookies)) {
      if (cookieName.startsWith(prefix) && cookieName.length > prefix.length) {
        const encoded = cookieName.slice(prefix.length);
        let storeName: string;

        try {
          storeName = decodeURIComponent(encoded);
        } catch {
          storeName = encoded; // Not written by this library
        }

        appCookies[storeName] = value;
      }
    }

    return appCookies;
  }

  /**
   * Build and set a cookie with the instance's configured options.
   * Pass options parameter to override specific settings (e.g., maxAge: 0 to delete).
   */
  #setCookie(name: string, value: string, overrides: Partial<ReactiveCookieStorageOptions> = {}): void {
    const opts = { ...this.options, ...overrides };
    let cookie = `${name}=${encodeURIComponent(value)}`;

    if (opts.path !== undefined) cookie += `; path=${opts.path}`;
    if (opts.domain) cookie += `; domain=${opts.domain}`;
    if (opts.maxAge !== undefined) cookie += `; max-age=${opts.maxAge}`;
    if (opts.expires) cookie += `; expires=${opts.expires.toUTCString()}`;
    if (opts.secure) cookie += '; secure';
    if (opts.sameSite) cookie += `; samesite=${opts.sameSite}`;

    document.cookie = cookie;
  }

  /**
   * Validate that a cookie string doesn't exceed size limits.
   * Throws an error if the cookie is too large.
   */
  #validateSize(cookieString: string): void {
    if (cookieString.length > ReactiveCookieStorage.#MAX_COOKIE_SIZE) {
      throw new Error(
        `Cookie size (${cookieString.length} bytes) exceeds ${ReactiveCookieStorage.#MAX_COOKIE_SIZE} byte limit. ` +
          `Consider using localStorage for larger data or splitting across multiple stores.`
      );
    }
  }

  /**
   * Notify all other linked storage instances about a change.
   * This instance will not be notified (to prevent infinite loops).
   */
  #notifyLinkedInstances(event: ReactiveStorageChangeEvent<S>): void {
    if (!this.#linker) return;

    const linkedInstances = ReactiveCookieStorage.#LINKERS.get(this.#linker);
    if (!linkedInstances) return;

    for (const instance of linkedInstances) {
      if (instance !== this) {
        instance.#changes$.next(event);
      }
    }
  }
}
