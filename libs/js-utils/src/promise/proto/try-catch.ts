import { tryCatch, TryCatchResult } from '@telperion/js-utils/promise/try-catch';

declare global {
  export interface Promise<T> {
    /**
     * #### Promise Try Catch
     *
     * Merges result and error in the same callback
     *
     * * * *
     * Example:
     * ```typescript
     * import "@telperion/js-utils/promise/proto/try-catch";
     *
     * async function fooFunction() {
     *   const [error, result] = await anAsyncCall().tryCatch();
     *
     *   if (error !== null) {
     *     // handle error
     *     return;
     *   }
     *
     *   result; // narrowed to the resolved type
     * }
     *
     * ```
     * * * *
     * @see tryCatch
     */
    tryCatch<E = unknown>(): Promise<TryCatchResult<T, E>>;

    /**
     * #### Promise Try Catch
     *
     * Merges result and error in the same callback
     *
     * * * *
     * @see tryCatch
     * @param defaultResult Setting this will put the value into the result field when the promise throws error
     */
    tryCatch<E = unknown>(defaultResult: T): Promise<TryCatchResult<T, E, T>>;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
Promise.prototype.tryCatch = function(this: Promise<any>, ...defaultResult: [any?]): Promise<TryCatchResult<any, any, any>> {
  return tryCatch(this, ...(defaultResult as [any]));
};
