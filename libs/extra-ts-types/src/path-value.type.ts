/**
 * ### PathValue
 *
 * The type of the value reached by following a list of keys into an object
 *
 * Resolves `T[P[0]][P[1]]...`, the way `obj?.a?.b?.c` reads at runtime: when a link on the way
 * may be `null` or `undefined`, or a union member lacks the next key, the result includes
 * `undefined` instead of failing. An empty path resolves to `T` itself. This is the result type
 * of `pluck` from `@telperion/rx-utils/operators`.
 *
 * * * *
 * Example usage:
 * ```typescript
 * import type { PathValue } from "@telperion/extra-ts-types";
 *
 * type State = { user: { name: { first: string } }; team?: { lead: string } };
 *
 * type First = PathValue<State, ["user", "name", "first"]>;
 * // string
 *
 * type Lead = PathValue<State, ["team", "lead"]>;
 * // string | undefined
 *
 * type Item = PathValue<{ items: string[] }, ["items", number]>;
 * // string
 * ```
 * * * *
 * @template T Object to start from
 * @template P Keys to follow, in order
 */
export type PathValue<T, P extends readonly PropertyKey[]> = P extends readonly [infer K, ...infer Rest extends readonly PropertyKey[]]
  ? T extends null | undefined // distributes over unions, so each member resolves on its own
    ? undefined
    : K extends keyof T
      ? PathValue<T[K], Rest>
      : undefined
  : T;
