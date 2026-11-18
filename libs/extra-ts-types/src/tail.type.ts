/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * ### Tail
 *
 * A tuple without its first element
 *
 * Works with labelled, optional and rest elements, and with function parameter lists, which
 * makes it handy for typing wrappers that supply the first argument themselves. The result is
 * always mutable, even for a `readonly` tuple. An empty tuple stays empty, and an array type
 * such as `string[]` is returned unchanged.
 *
 * * * *
 * Example usage:
 * ```typescript
 * import type { Tail } from "@telperion/extra-ts-types";
 *
 * type Rest = Tail<[1, 2, 3]>;
 * // [2, 3]
 *
 * function withContext<F extends (ctx: Context, ...args: any[]) => any>(fn: F) {
 *   return (...args: Tail<Parameters<F>>): ReturnType<F> => fn(currentContext(), ...args);
 * }
 *
 * const save = withContext((ctx: Context, id: number, body: string) => ctx.db.save(id, body));
 * save(1, "hello"); // (id: number, body: string) => ...
 * ```
 * * * *
 * @template X Tuple or parameter list
 */
export type Tail<X extends readonly any[]> = ((...args: X) => any) extends (arg: any, ...rest: infer U) => any
  ? U
  : never;
