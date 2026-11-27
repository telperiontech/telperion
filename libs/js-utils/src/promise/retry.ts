import { timeout } from '@telperion/js-utils/promise/timeout';

/**
 * Options of {@link retry}
 */
export interface RetryOptions {
  /**
   * How many times to retry after the first attempt fails
   *
   * `0` runs the task once. Negative values count as `0`.
   *
   * @default 3
   */
  count?: number;

  /**
   * Milliseconds to wait before each retry, or a function that returns them
   *
   * The function receives the number of the retry (`1` for the first retry) and the error of the failed attempt.
   *
   * @default 0
   */
  delay?: number | ((attempt: number, error: unknown) => number);

  /**
   * Decides whether an error qualifies for a retry
   *
   * When it returns `false`, `retry` rejects with that error immediately.
   * Receives the error and the number of the retry that would follow (`1` for the first retry).
   *
   * @default () => true
   */
  when?: (error: unknown, attempt: number) => boolean;
}

/**
 * #### Retry
 *
 * Runs a promise-returning task and runs it again when it fails, waiting between attempts,
 * as long as the error qualifies (`when`) and retries are left (`count`).
 * Resolves with the first successful result, rejects with the last error.
 *
 * The task is called once per attempt, so it should create a new promise each time.
 * A task that throws synchronously counts as a failed attempt.
 *
 * * * *
 * Example:
 * ```typescript
 * import { retry } from "@telperion/js-utils/promise";
 * import { seconds } from "@telperion/js-utils/time";
 *
 * // Retry only network failures, waiting 2 s, 4 s and 8 s
 * const session = await retry(() => refreshSession(), {
 *   count: 3,
 *   delay: attempt => seconds(2 ** attempt),
 *   when: error => error instanceof TypeError,
 * });
 * ```
 *
 * Static Example:
 * ```typescript
 * import "@telperion/js-utils/promise/static/retry";
 *
 * const data = await Promise.retry(() => fetch(url), { count: 2, delay: 500 });
 * ```
 * * * *
 * @param task Function that starts the work and returns its promise
 * @param options Retry count, delay and the error filter
 * @returns The result of the first successful attempt
 */
export function retry<T>(task: () => T | PromiseLike<T>, { count = 3, delay = 0, when = () => true }: RetryOptions = {}): Promise<T> {
  const run = (attempt: number): Promise<T> =>
    new Promise<T>(resolve => resolve(task())).catch((error: unknown) =>
      attempt <= count && when(error, attempt)
        ? timeout(typeof delay === 'function' ? delay(attempt, error) : delay).then(() => run(attempt + 1))
        : Promise.reject(error),
    );

  return run(1);
}
