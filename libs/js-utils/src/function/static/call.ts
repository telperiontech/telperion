import { call } from '@telperion/js-utils/function/call';

declare global {
  export interface FunctionConstructor {
    /**
     * #### Call
     *
     * Calls the given function without arguments and returns its result.
     *
     * * * *
     * Example as Function static method:
     * ```typescript
     * import "@telperion/js-utils/function/static/call";
     *
     * const value = Function.call(() => 42); // 42
     * ```
     * * * *
     * @param func Function to call
     * @returns The value returned by `func`
     */
    call: typeof call;
  }
}

Function.call = call;
