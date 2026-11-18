/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * ### AnyFunction
 *
 * Any function: any parameters, any return type
 *
 * A constraint for code that stores, wraps or forwards functions without caring about their
 * signature (decorators, debouncers, event registries). It accepts every function, while
 * `Function` is too loose to call and `(...args: unknown[]) => unknown` rejects functions with
 * typed parameters.
 *
 * * * *
 * Example usage:
 * ```typescript
 * import type { AnyFunction } from "@telperion/extra-ts-types";
 *
 * function once<F extends AnyFunction>(fn: F): F {
 *   let called = false;
 *   let result: ReturnType<F>;
 *
 *   return ((...args: Parameters<F>) => {
 *     if (!called) {
 *       called = true;
 *       result = fn(...args);
 *     }
 *
 *     return result;
 *   }) as F;
 * }
 *
 * const init = once((id: number) => `ready ${id}`); // (id: number) => string
 * ```
 * * * *
 */
export type AnyFunction = (...args: any[]) => any;
