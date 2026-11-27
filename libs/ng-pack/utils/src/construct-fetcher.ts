import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { inject, Injector } from "@angular/core";
import { AnyFunction } from '@telperion/extra-ts-types';
import { tryCatch, TryCatchResult } from "@telperion/js-utils/promise/try-catch";
import { firstValueFrom, Observable } from 'rxjs';

/**
 * Error type of a {@link Fetcher} result when none is given
 *
 * `HttpClient` fails with an `HttpErrorResponse`; interceptors usually throw an `Error`.
 */
export type FetcherError = HttpErrorResponse | Error;

/**
 * Promise-based mirror of `HttpClient`: every method resolves with an `[error, response]` tuple
 *
 * The tuple is a discriminated union ({@link TryCatchResult}), so `if (error) return;` narrows the response to `T`.
 * Pass a second type argument to change the error type, e.g. `fetcher.get<User, unknown>(url)`
 * (then check `error !== null`, since an `unknown` error may be falsy).
 */
export type Fetcher = {
  [P in keyof HttpClient]: HttpClient[P] extends (...args: infer A) => Observable<unknown>
    ? <T, E = FetcherError>(...args: A) => Promise<TryCatchResult<T, E>>
    : never;
}

/**
 * Constructs a Fetcher that proxies HttpClient methods and returns a tuple of [error, response].
 * If the HttpClient method throws an error, it will be caught and returned as the first element of the tuple.
 * If the HttpClient method succeeds, the response will be returned as the second element of the tuple.
 * The tuple is a discriminated union: checking the error narrows the response.
 * Example usage:
 * ```
 * @Component({
 *   selector: 'app-example',
 *   template: `<button (click)="fetchData()">Fetch Data</button>`,
 * })
 * export class ExampleComponent {
 *   private fetcher = constructFetcher();
 *
 *   async fetchData() {
 *     const [error, response] = await this.fetcher.get<Data>('/api/data');
 *
 *     if (error) {
 *       console.error('Error fetching data:', error);
 *       return;
 *     }
 *
 *     console.log('Fetched data:', response); // Data
 *   }
 * }
 * ```
 */
export function constructFetcher(injector?: Injector) {
  const client = injector ? injector.get(HttpClient) : inject(HttpClient);

  return new Proxy({} as Fetcher, {
    get(target, prop) {
      if (prop in client) {
        return (...args: any[]) => {
          const method = (client as any)[prop] as AnyFunction;

          return tryCatch(firstValueFrom(method.apply(client, args)));
        }
      }

      throw new Error(`HttpClient does not have method ${String(prop)}`);
    }
  });
}
