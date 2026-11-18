/**
 * ### PartialSome
 *
 * An object type with only the given keys made optional
 *
 * `Partial<T>` makes every property optional; `PartialSome` picks which ones. The other
 * properties keep their modifiers. Typical use: input types where some fields have defaults.
 *
 * * * *
 * Example usage:
 * ```typescript
 * import type { PartialSome } from "@telperion/extra-ts-types";
 *
 * interface User {
 *   id: number;
 *   name: string;
 *   role: "admin" | "member";
 * }
 *
 * type NewUser = PartialSome<User, "id" | "role">;
 * // same shape as { name: string; id?: number; role?: "admin" | "member" }
 *
 * function createUser({ id = Date.now(), role = "member", name }: NewUser): User {
 *   return { id, name, role };
 * }
 * ```
 * * * *
 * @template T Object type
 * @template K Keys of `T` to make optional
 */
export type PartialSome<T extends object, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
