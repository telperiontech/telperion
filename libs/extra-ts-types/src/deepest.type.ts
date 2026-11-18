/**
 * `true` when `V` is mutually assignable with a member of `Seen`: the chain loops back to an
 * object it already followed, whose stops are already in the result
 */
type Visited<V, Seen> = true extends (Seen extends unknown ? ([V] extends [Seen] ? ([Seen] extends [V] ? true : never) : never) : never)
  ? true
  : false;

/**
 * ### DeepestValue
 *
 * The value at the end of a chain of objects linked by the same key
 *
 * Follows `T[K]`, then `T[K][K]`, and so on, while the value is an object that has `K`, and
 * resolves to the first value that does not continue the chain. Optional and nullable links
 * branch, so the result is the union of every place the chain can end.
 *
 * * * *
 * Example usage:
 * ```typescript
 * import type { DeepestValue } from "@telperion/extra-ts-types";
 *
 * type Response = { data: { data: { data: string } } };
 *
 * type Payload = DeepestValue<Response, "data">;
 * // string
 *
 * type ListNode = { value: number; next: ListNode | null };
 *
 * type End = DeepestValue<ListNode, "next">;
 * // null
 * ```
 * * * *
 * @template T Object at the start of the chain
 * @template K Key that links each object to the next
 * @template Seen Internal: objects already followed, to stop on cycles. Leave it unset
 */
export type DeepestValue<T, K extends keyof T, Seen = T> = T[K] extends infer V // `infer` distributes over nullable links
  ? V extends object
    ? K extends keyof V
      ? Visited<V, Seen> extends true ? never : DeepestValue<V, K, Seen | V>
      : V
    : V
  : never;

/**
 * ### DeepestObject
 *
 * The last object in a chain of objects linked by the same key
 *
 * Follows `T[K]`, then `T[K][K]`, and so on, while the value is an object, and resolves to the
 * last object reached: one whose `K` is missing or not an object. This is the return type of
 * `deepest` from `@telperion/js-utils/object/deepest`. Optional and nullable links branch, so
 * the result is the union of every object the chain can end at.
 *
 * * * *
 * Example usage:
 * ```typescript
 * import type { DeepestObject } from "@telperion/extra-ts-types";
 *
 * type Wrapped = { data: { data: { value: string; other: number } } };
 *
 * type Inner = DeepestObject<Wrapped, "data">;
 * // { value: string; other: number }
 *
 * type Root = { parent: Folder };
 * type Folder = { name: string; parent: Drive };
 * type Drive = { name: string; parent: null };
 *
 * type Top = DeepestObject<Root, "parent">;
 * // Drive
 * ```
 * * * *
 * @template T Object at the start of the chain
 * @template K Key that links each object to the next
 * @template Seen Internal: objects already followed, to stop on cycles. Leave it unset
 */
export type DeepestObject<T, K extends keyof T, Seen = T> = T[K] extends infer V // `infer` distributes over nullable links
  ? V extends object
    ? K extends keyof V
      ? Visited<V, Seen> extends true ? never : DeepestObject<V, K, Seen | V>
      : V
    : T
  : never;
