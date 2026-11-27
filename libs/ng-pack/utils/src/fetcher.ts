import type { HttpClient, HttpErrorResponse } from "@angular/common/http";
import type { RetryOptions } from '@telperion/js-utils/promise/retry';
import type { TryCatchResult } from "@telperion/js-utils/promise/try-catch";
import type { Observable } from 'rxjs';

/**
 * Error type of a {@link Fetcher} result when none is given
 *
 * `HttpClient` fails with an `HttpErrorResponse`; interceptors usually throw an `Error`.
 */
export type FetcherError = HttpErrorResponse | Error;

/**
 * Retry options of {@link Fetcher.withRetry}: js-utils {@link RetryOptions}, with the error typed as the fetcher's error type
 *
 * The error type is what the fetcher assumes requests fail with ({@link FetcherError} by default); it is not checked at runtime.
 *
 * @template E Error type passed to `delay` and `when`
 */
export interface FetcherRetryOptions<E = FetcherError> extends Pick<RetryOptions, 'count'> {
  /**
   * Milliseconds to wait before each retry, or a function of the retry number (`1` for the first retry) and the error
   *
   * @default 0
   */
  delay?: number | ((attempt: number, error: E) => number);

  /**
   * Decides whether an error qualifies for a retry; when it returns `false`, the call resolves with that error immediately
   *
   * Receives the error and the number of the retry that would follow (`1` for the first retry).
   *
   * @default () => true
   */
  when?: (error: E, attempt: number) => boolean;
}

/**
 * Promise-based `HttpClient` methods of a {@link Fetcher}
 *
 * @template D Default error type of the results
 */
export type FetcherMethods<D = FetcherError> = {
  [P in keyof HttpClient]: HttpClient[P] extends (...args: infer A) => Observable<unknown>
    ? <T, E = D>(...args: A) => Promise<TryCatchResult<T, E>>
    : never;
};

/**
 * Promise-based mirror of `HttpClient`: every method resolves with an `[error, response]` tuple
 *
 * The tuple is a discriminated union ({@link TryCatchResult}), so `if (error) return;` narrows the response to `T`.
 * Pass a second type argument to change the error type, e.g. `fetcher.get<User, unknown>(url)`
 * (then check `error !== null`, since an `unknown` error may be falsy).
 *
 * @template D Default error type of the results
 */
export type Fetcher<D = FetcherError> = FetcherMethods<D> & {
  /**
   * Returns a fetcher whose calls retry failed requests (js-utils `retry`), sending the request again on each attempt
   *
   * Calls still resolve with an `[error, response]` tuple: the response of the first successful attempt,
   * or the last error once `when` returns `false` or the retries are used up.
   * The options replace any retry options of this fetcher; the fetcher it is called on is unchanged.
   *
   * ```typescript
   * const [, session] = await this.#fetcher
   *   .withRetry({ count: 3, delay: n => seconds(2 ** n), when: error => error instanceof HttpErrorResponse && error.status === 0 })
   *   .post<Session>(url, null, { withCredentials: true });
   * ```
   *
   * @param options Retry count, delay and the error filter
   * @template E Error type `delay` and `when` receive, and the default error type of the results.
   * Not inferred from the options (a `when` taking `unknown` keeps the fetcher's error type); pass it to change it.
   */
  withRetry<E = D>(options: FetcherRetryOptions<NoInfer<E>>): Fetcher<E>;
};
