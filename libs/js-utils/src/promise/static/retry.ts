import { retry } from '@telperion/js-utils/promise/retry';

declare global {
  export interface PromiseConstructor {
    /**
     * #### Retry
     * Runs a promise-returning task and runs it again when it fails, waiting between attempts,
     * as long as the error qualifies (`when`) and retries are left (`count`).
     *
     * * * *
     * Example:
     * ```typescript
     * import "@telperion/js-utils/promise/static/retry";
     *
     * const data = await Promise.retry(() => fetch(url), { count: 2, delay: 500 });
     * ```
     * * * *
     * @see retry
     */
    retry: typeof retry;
  }
}

Promise.retry = retry;
