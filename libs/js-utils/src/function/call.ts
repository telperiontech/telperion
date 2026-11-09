/**
 * #### Call
 *
 * Calls the given function without arguments and returns its result.
 * Handy for running an inline initializer where an expression is expected.
 *
 * * * *
 * Example usage:
 * ```typescript
 * import { call } from "@telperion/js-utils/function/call";
 *
 * const config = call(() => {
 *   const base = loadDefaults();
 *   return { ...base, debug: true };
 * });
 * ```
 * * * *
 * @param func Function to call
 * @returns The value returned by `func`
 */
export function call<T>(func: (...args: any[]) => T): T {
  return func();
}
