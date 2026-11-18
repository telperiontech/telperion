/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * ### Join
 *
 * Every ordered combination of a string union's members, joined with a separator
 *
 * Each member appears at most once per combination, and single members are included. Handy for
 * typing values like CSS shorthand lists or comma-separated flags. The number of combinations
 * grows factorially, so keep the union small (about 6 members at most) or TypeScript gives up
 * with "Expression produces a union type that is too complex to represent".
 *
 * * * *
 * Example usage:
 * ```typescript
 * import type { Join } from "@telperion/extra-ts-types";
 *
 * type Pair = Join<"x" | "y">;
 * // "x" | "y" | "x,y" | "y,x"
 *
 * type Flags = Join<"a" | "b" | "c", "-">;
 * // "a" | "b" | "c" | "a-b" | "a-c" | "b-a" | "b-c" | "c-a" | "c-b"
 * // | "a-b-c" | "a-c-b" | "b-a-c" | "b-c-a" | "c-a-b" | "c-b-a"
 * ```
 * * * *
 * @template T Union of strings to combine
 * @template Sep Separator between members. Defaults to `","`
 * @template U Internal: the member placed first. Leave it unset
 */
export type Join<T extends string, Sep extends string = ',', U extends string = T> =
  U extends any ?
    | U
    | `${U}${Sep}${Join<Exclude<T, U>, Sep>}`
  : never;
