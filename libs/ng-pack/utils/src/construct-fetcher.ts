import { HttpClient } from "@angular/common/http";
import { inject, Injector } from "@angular/core";
import { AnyFunction } from '@telperion/extra-ts-types';
import { retry, type RetryOptions } from '@telperion/js-utils/promise/retry';
import { tryCatch } from "@telperion/js-utils/promise/try-catch";
import { firstValueFrom } from 'rxjs';

import type { Fetcher, FetcherRetryOptions } from './fetcher';

/**
 * Constructs a Fetcher that proxies HttpClient methods and returns a tuple of [error, response].
 * If the HttpClient method throws an error, it will be caught and returned as the first element of the tuple.
 * If the HttpClient method succeeds, the response will be returned as the second element of the tuple.
 * The tuple is a discriminated union: checking the error narrows the response.
 *
 * `fetcher.withRetry(options)` returns a fetcher whose calls retry failed requests (js-utils `retry` options)
 * and still resolve with the tuple, holding the last error once the retries are used up.
 *
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
 *
 *     // Retry network failures (status 0) up to 3 times, waiting 2 s, 4 s and 8 s
 *     const [, fresh] = await this.fetcher
 *       .withRetry({ count: 3, delay: n => seconds(2 ** n), when: e => e instanceof HttpErrorResponse && e.status === 0 })
 *       .get<Data>('/api/data');
 *   }
 * }
 * ```
 *
 * @param injector Injector to get `HttpClient` from, when called outside an injection context
 */
export function constructFetcher(injector?: Injector): Fetcher {
  return createFetcher(injector ? injector.get(HttpClient) : inject(HttpClient), { count: 0 });
}

/**
 * Creates the fetcher proxy of a client; each method call runs the request through `retry` with the given options
 * (`count: 0` runs it once), so every attempt subscribes to a new request
 */
function createFetcher(client: HttpClient, retryOptions: RetryOptions): Fetcher {
  return new Proxy({} as Fetcher, {
    get(target, prop) {
      if (prop === 'withRetry') {
        return (options: FetcherRetryOptions<unknown>) => createFetcher(client, options);
      }

      if (prop in client) {
        return (...args: unknown[]) => {
          const method = (client as unknown as Record<PropertyKey, AnyFunction>)[prop];

          return tryCatch(retry(() => firstValueFrom(method.apply(client, args)), retryOptions));
        };
      }

      throw new Error(`HttpClient does not have method ${String(prop)}`);
    }
  });
}
