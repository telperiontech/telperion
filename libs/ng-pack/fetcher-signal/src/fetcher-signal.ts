import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injector, signal, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map as objectMap } from '@telperion/js-utils/object/map';
import { isFalsy } from '@telperion/js-utils/is-falsy';
import { defer } from '@telperion/js-utils/function/defer';
import { toObservable } from "@telperion/ng-pack/utils";
import { shareLast } from "@telperion/rx-utils/operators/share-last";
import { combineLatest, Observable, of, map, debounceTime, switchMap, catchError, tap, mergeWith, Subject, mapTo, startWith, filter, firstValueFrom, merge } from "rxjs";

interface FetcherSignalOptionTypes<
  Result,
  Body,
  Params extends Record<string, string>,
  QueryParams extends Record<string, string> | HttpParams
> {
  url?: string;
  method?: Parameters<HttpClient['request']>[0];
  headers?: Record<string, string>;
  body?: Body;
  queryParams?: QueryParams;
  params?: Params;
  fallback?: Result;
}

type ParsedFetcherSignalOptions<
  Result,
  Body,
  Params extends Record<string, string>,
  QueryParams extends Record<string, string> | HttpParams
> = {
  [K in keyof FetcherSignalOptionTypes<Result, Body, Params, QueryParams>]: Observable<FetcherSignalOptionTypes<Result, Body, Params, QueryParams>[K]>;
}

type OptionDefaults<
  Result,
  Body,
  Params extends Record<string, string>,
  QueryParams extends Record<string, string> | HttpParams
> = {
  [K in keyof FetcherSignalOptionTypes<Result, Body, Params, QueryParams>]-?: FetcherSignalOptionTypes<Result, Body, Params, QueryParams>[K];
}

/**
 * Options accepted by {@link fetcherSignal}.
 *
 * Every field accepts a plain value, a `Signal`, a `Promise`, or an `Observable`
 * of that value. When a reactive option emits a new value, the request is
 * re-executed (debounced by 10ms).
 *
 * - `url` — endpoint URL. Supports `:name` placeholders filled from `params`.
 * - `method` — HTTP method (default: `'get'`).
 * - `headers` — request headers.
 * - `body` — request body for non-`get` methods.
 * - `queryParams` — query string parameters as a plain object or `HttpParams`.
 * - `params` — values for `:name` URL placeholders (URL-encoded; missing keys throw).
 * - `fallback` — initial signal value AND the value emitted when the request errors.
 * - `reloadOn` — an `Observable` whose every emission re-runs the current request, like
 *   `reload()` but declarative (e.g. a server-sent event stream announcing changes). Its values
 *   are ignored. It is subscribed while the fetcher has a request to run, and subscribed again
 *   when the other options change.
 */
export type FetcherSignalOptions<
  Result,
  Body,
  Params extends Record<string, string>,
  QueryParams extends Record<string, string> | HttpParams
> = {
  [K in keyof FetcherSignalOptionTypes<Result, Body, Params, QueryParams>]:
    FetcherSignalOptionTypes<Result, Body, Params, QueryParams>[K]
    | Signal<FetcherSignalOptionTypes<Result, Body, Params, QueryParams>[K]>
    | Promise<FetcherSignalOptionTypes<Result, Body, Params, QueryParams>[K]>
    | Observable<FetcherSignalOptionTypes<Result, Body, Params, QueryParams>[K]>;
} & {
  reloadOn?: Observable<unknown>;
}

/**
 * A `Signal<Result>` extended with request state and a manual reload trigger.
 *
 * - call the signal to read the latest result (or `fallback` before the first response)
 * - `error` — latest error; reset to `null` on each successful response
 * - `loading` — `true` while a request is in flight, `false` once a value is emitted
 * - `reload()` — re-run the current request without changing options (declaratively: the
 *   `reloadOn` option). Returns a
 *   `Promise<void>` that resolves once the next value (response or fallback-on-error)
 *   has been emitted into the signal.
 * - `loaded` — getter returning a fresh `Promise<void>` that resolves the next time
 *   `loading` flips back to `false`. Useful for `await`ing the next response in tests,
 *   route resolvers, or effects without subscribing to signals.
 */
export type FetcherSignal<Result> = Signal<Result> & {
  error: Signal<Error | null>;
  loading: Signal<boolean>;
  reload(): Promise<void>;
  readonly loaded: Promise<void>;
}

/**
 * Creates a reactive HTTP fetcher exposed as a `Signal`.
 *
 * Built on Angular's `HttpClient`. Any reactive option ({@link FetcherSignalOptions})
 * automatically re-triggers the request when it changes. Exposes `loading` and `error`
 * signals plus a `reload()` method.
 *
 * @param options Request configuration. See {@link FetcherSignalOptions}.
 * @param injector Optional `Injector` for use outside an injection context.
 * @returns A {@link FetcherSignal} for the response.
 *
 * @example
 * ```ts
 * const users = fetcherSignal<User[]>({
 *   url: '/api/users',
 *   queryParams: computed(() => ({ q: search() })),
 *   fallback: []
 * });
 *
 * users();          // current value (or fallback)
 * users.loading();  // boolean
 * users.error();    // Error | null
 * await users.loaded;     // wait for the next response
 * await users.reload();   // re-run request and wait for the next response
 * ```
 */
export function fetcherSignal<
  Result = any,
  Body = null,
  Params extends Record<string, string> = {},
  QueryParams extends Record<string, string> | HttpParams = {}
>(
  options: FetcherSignalOptions<Result, Body, Params, QueryParams>,
  injector?: Injector
): FetcherSignal<Result> {
  // Kept for the whole lifetime: signal options, toSignal and the `loaded` getter (called later,
  // e.g. from a click handler through reload()) all need it outside the injection context.
  const contextInjector = injector ?? inject(Injector);
  const client = contextInjector.get(HttpClient);
  const defaultOptions: OptionDefaults<Result, Body, Params, QueryParams> = {
    url: '',
    method: 'get',
    headers: {},
    body: null!,
    queryParams: {} as QueryParams,
    params: {} as Params,
    fallback: null!
  };

  const { reloadOn, ...requestOptions } = options;
  const {
    url,
    method,
    headers,
    body,
    queryParams,
    params,
    fallback
  } = parseOptions(requestOptions, contextInjector);

  const optionsArray = [
    url ?? of(defaultOptions.url),
    method ?? of(defaultOptions.method),
    headers ?? of(defaultOptions.headers),
    body ?? of(defaultOptions.body),
    queryParams ?? of(defaultOptions.queryParams),
    params ?? of(defaultOptions.params)
  ] as const;

  const sharedFallback = (fallback as Observable<Result> ?? of(defaultOptions.fallback)).pipe(shareLast());
  const errorSignal = signal<Error | null>(null);
  const loadingSignal = signal(true);
  const reloadTrigger = new Subject<void>();
  const reloads = reloadOn ? merge(reloadTrigger, reloadOn) : reloadTrigger;

  const result$ = combineLatest(optionsArray).pipe(
    map(([url, method, headers, body, queryParams, params]) => ({
      url: url ?? defaultOptions.url,
      method: method ?? defaultOptions.method,
      headers: headers ?? defaultOptions.headers,
      body: body ?? defaultOptions.body,
      queryParams: queryParams ?? defaultOptions.queryParams,
      params: params ?? defaultOptions.params
    })),
    debounceTime(10),
    switchMap(options => reloads.pipe(mapTo(options), startWith(options))),
    switchMap(({ url, method, headers, body, queryParams, params }) => {
      const finalUrl = parseUrlWithParams(url, params);

      loadingSignal.set(true);

      return client.request<Result>(method, finalUrl, { headers, body, observe: 'body', params: queryParams }).pipe(
        map(response => {
          errorSignal.set(null);
          return response;
        }),
        catchError(error => {
          errorSignal.set(error);
          return sharedFallback;
        }),
        tap(() => loadingSignal.set(false))
      );
    }),
    mergeWith(sharedFallback)
  );

  const resultSignal = toSignal(result$, { initialValue: defaultOptions.fallback, injector: contextInjector });

  return Object.assign(resultSignal, {
    error: errorSignal.asReadonly(),
    loading: loadingSignal.asReadonly(),
    reload() {
      reloadTrigger.next();

      return defer().then(() => this.loaded);
    },
    get loaded() {
      return firstValueFrom(toObservable(loadingSignal, contextInjector).pipe(
        filter(isFalsy),
        mapTo(void 0)
      ))
    }
  });
}

function parseUrlWithParams(url: string, params: Record<string, string>): string {
  return url.replace(/:([a-zA-Z0-9_]+)/g, (_, key) => {
    if (key in params) {
      return encodeURIComponent(params[key]);
    }
    throw new Error(`Missing parameter '${key}' for URL '${url}'`);
  });
}

function parseOptions<
  Result,
  Body,
  Params extends Record<string, string>,
  QueryParams extends Record<string, string> | HttpParams
>(
  options: Omit<FetcherSignalOptions<Result, Body, Params, QueryParams>, 'reloadOn'>,
  injector: Injector
) {
  return objectMap(options, value => toObservable(value, injector)) as ParsedFetcherSignalOptions<Result, Body, Params, QueryParams>;
}
